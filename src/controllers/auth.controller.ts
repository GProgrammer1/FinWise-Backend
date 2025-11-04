import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import { passwordService } from "../services/auth/password.service";
import { tokenService } from "../services/auth/token.service";
import { oauthService } from "../services/auth/oauth.service";
import { uploadService } from "../services/upload.service";
import { mailerService } from "../services/mailer.service";
import {
  signupSchema,
  loginSchema,
  oauthSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  validate,
} from "../validators/auth.validator";
import { jwtService } from "../services/auth/jwt.service";
import { successResponse, errors } from "../utils/response";

export class AuthController {
  /**
   * POST /auth/signup
   * Handle user signup (multipart/form-data)
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      // Parse and validate request body
      const body = {
        ...req.body,
        numberOfChildren: req.body.numberOfChildren
          ? parseInt(req.body.numberOfChildren)
          : undefined,
        monthlyIncomeBase: req.body.monthlyIncomeBase
          ? parseFloat(req.body.monthlyIncomeBase)
          : undefined,
        monthlyRentBase: req.body.monthlyRentBase
          ? parseFloat(req.body.monthlyRentBase)
          : undefined,
        monthlyLoansBase: req.body.monthlyLoansBase
          ? parseFloat(req.body.monthlyLoansBase)
          : undefined,
      };

      const data = validate(signupSchema, body);

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        errors.conflict(res, "Email already registered");
        return;
      }

      // For PARENT, require ID image upload
      if (data.role === "PARENT" && !req.file) {
        errors.unsupportedMedia(
          res,
          "ID image is required for parent accounts"
        );
        return;
      }

      // For PARENT, send admin notification email with ID image for manual approval
      // No OCR validation - admin will review manually

      // Hash password
      const passwordHash = await passwordService.hash(data.password);

      // Upload ID image if provided
      let idImageUrl: string | undefined;
      if (req.file) {
        const uploadResult = await uploadService.uploadFile(
          req.file,
          "id-verification"
        );
        idImageUrl = uploadResult.url;
      }

      // Create user and related entities in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash,
            role: data.role,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        // Create verification request
        const verificationRequest = await tx.verificationRequest.create({
          data: {
            userId: user.id,
            role: data.role,
            status: "PENDING",
            idImageUrl,
          },
        });

        // Create parent profile if role is PARENT
        let parentProfile;
        if (data.role === "PARENT") {
          parentProfile = await tx.parentProfile.create({
            data: {
              userId: user.id,
              country: data.country,
              numberOfChildren: data.numberOfChildren,
              monthlyIncomeBase: data.monthlyIncomeBase,
              monthlyRentBase: data.monthlyRentBase,
              monthlyLoansBase: data.monthlyLoansBase,
              otherNotes: data.otherNotes,
            },
          });
        }

        return { user, verificationRequest, parentProfile };
      });

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(
        result.user.id,
        result.user.email,
        result.user.role
      );

      // Send welcome email
      if (data.role === "PARENT") {
        // Send welcome email to parent (pending verification)
        await mailerService.sendParentWelcomeEmail(
          result.user.email,
          result.user.name
        );

        // Send admin notification email with ID image for approval
        if (req.file && req.file.buffer) {
          await mailerService.sendParentSignupNotificationToAdmin(
            result.user.email,
            result.user.name,
            result.user.id,
            req.file.buffer,
            req.file.originalname || "id-image.jpg"
          );
        }
      } else {
        await mailerService.sendChildWelcomeEmail(
          result.user.email,
          result.user.name
        );
      }

      successResponse(
        res,
        {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          verificationStatus: result.verificationRequest.status,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        201
      );
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Signup error:", error);
        errors.internal(res, "Signup failed");
      }
    }
  }

  /**
   * POST /auth/login
   * Handle user login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(loginSchema, req.body);

      // Find user by email
      const user = await prisma.user.findFirst({
        where: {
          email: data.email,
          deletedAt: null,
        },
        include: {
          verificationRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!user || !user.passwordHash) {
        errors.unauthorized(res, "Invalid email or password");
        return;
      }

      // Verify password (constant-time)
      const isValid = await passwordService.verify(
        user.passwordHash,
        data.password
      );
      if (!isValid) {
        errors.unauthorized(res, "Invalid email or password");
        return;
      }

      // Check if password needs rehashing
      if (passwordService.needsRehash(user.passwordHash)) {
        const newHash = await passwordService.hash(data.password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(
        user.id,
        user.email,
        user.role
      );

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        verificationStatus: user.verificationRequests[0]?.status || "PENDING",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Login error:", error);
        errors.internal(res, "Login failed");
      }
    }
  }

  /**
   * POST /auth/oauth
   * Handle OAuth login (Google/Apple)
   */
  async oauth(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(oauthSchema, req.body);

      // Verify OAuth token
      let oauthPayload: { sub: string; email?: string; name?: string };

      if (data.provider === "google") {
        oauthPayload = await oauthService.verifyGoogleToken(data.idToken);
      } else {
        oauthPayload = await oauthService.verifyAppleToken(data.idToken);
      }

      if (!oauthPayload.email) {
        errors.badRequest(res, "Email not provided by OAuth provider");
        return;
      }

      // Find existing OAuth account
      const existingOAuth = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: data.provider.toUpperCase() as any,
            providerId: oauthPayload.sub,
          },
        },
        include: {
          user: {
            include: {
              verificationRequests: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      let user;
      let isNewUser = false;

      if (existingOAuth) {
        // User already has OAuth account
        user = existingOAuth.user;
      } else {
        // Check if user with same email exists
        const existingUser = await prisma.user.findUnique({
          where: { email: oauthPayload.email },
          include: {
            verificationRequests: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (existingUser) {
          // Link OAuth account to existing user
          await prisma.oAuthAccount.create({
            data: {
              provider: data.provider.toUpperCase() as any,
              providerId: oauthPayload.sub,
              userId: existingUser.id,
            },
          });
          user = existingUser;
        } else {
          // Create new user with OAuth account
          isNewUser = true;
          user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                email: oauthPayload.email!,
                name: oauthPayload.name || oauthPayload.email!.split("@")[0],
                role: "PARENT", // Default to PARENT for OAuth
              },
              include: {
                verificationRequests: true,
              },
            });

            await tx.oAuthAccount.create({
              data: {
                provider: data.provider.toUpperCase() as any,
                providerId: oauthPayload.sub,
                userId: newUser.id,
              },
            });

            // Create pending verification request
            await tx.verificationRequest.create({
              data: {
                userId: newUser.id,
                role: "PARENT",
                status: "PENDING",
              },
            });

            return newUser;
          });

          // Send welcome email
          await mailerService.sendParentWelcomeEmail(user.email, user.name);
        }
      }

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(
        user.id,
        user.email,
        user.role
      );

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        verificationStatus: user.verificationRequests[0]?.status || "PENDING",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isNewUser,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else if (error.message.includes("Invalid")) {
        errors.unauthorized(res, error.message);
      } else {
        console.error("OAuth error:", error);
        errors.internal(res, "OAuth authentication failed");
      }
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(refreshSchema, req.body);

      const tokens = await tokenService.refreshTokens(data.refreshToken);

      successResponse(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        errors.unauthorized(res, error.message || "Token refresh failed");
      }
    }
  }

  /**
   * POST /auth/logout
   * Revoke refresh token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Refresh token is optional - frontend may call without body
      const refreshToken = req.body?.refreshToken;

      if (refreshToken) {
        try {
          await tokenService.revokeRefreshToken(refreshToken);
        } catch (error) {
          // Ignore errors - token might already be revoked
          console.warn("Logout: Failed to revoke token:", error);
        }
      }

      successResponse(res, { message: "Logged out successfully" });
    } catch (error: any) {
      // Still return success even on error
      successResponse(res, { message: "Logged out successfully" });
    }
  }

  /**
   * GET /auth/me
   * Get current user profile (requires authentication)
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errors.unauthorized(res);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          verificationRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          parentProfile: true,
        },
      });

      if (!user) {
        errors.notFound(res, "User not found");
        return;
      }

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        verificationStatus: user.verificationRequests[0]?.status || "PENDING",
        parentProfile: user.parentProfile
          ? {
              country: user.parentProfile.country,
              numberOfChildren: user.parentProfile.numberOfChildren,
              monthlyIncomeBase: user.parentProfile.monthlyIncomeBase,
              monthlyRentBase: user.parentProfile.monthlyRentBase,
              monthlyLoansBase: user.parentProfile.monthlyLoansBase,
            }
          : null,
      });
    } catch (error: any) {
      console.error("Get user error:", error);
      errors.internal(res, "Failed to get user profile");
    }
  }

  /**
   * POST /auth/forgot-password
   * Request password reset email
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(forgotPasswordSchema, req.body);

      // Find user by email
      const user = await prisma.user.findFirst({
        where: {
          email: data.email,
          deletedAt: null,
        },
      });

      // Always return success to prevent email enumeration
      // Don't reveal if email exists or not
      successResponse(res, {
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });

      // Only proceed if user exists and has a password (not OAuth-only)
      if (user && user.passwordHash) {
        // Generate password reset token
        const resetToken = jwtService.generatePasswordResetToken({
          userId: user.id,
          email: user.email,
          type: "password-reset",
        });

        // Create reset link
        const resetLink = `https://finwise.web.app/reset?token=${resetToken}`;

        // Send password reset email
        try {
          await mailerService.sendPasswordResetEmail(
            user.email,
            user.name,
            resetLink
          );
        } catch (emailError) {
          // Log error but don't fail the request
          console.error("Failed to send password reset email:", emailError);
        }
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Forgot password error:", error);
        // Still return success to prevent email enumeration
        successResponse(res, {
          message:
            "If an account exists with this email, a password reset link has been sent.",
        });
      }
    }
  }

  /**
   * POST /auth/reset-password
   * Reset password using token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(resetPasswordSchema, req.body);

      // Verify and decode reset token
      let payload;
      try {
        payload = jwtService.verifyPasswordResetToken(data.token);
      } catch (error: any) {
        errors.badRequest(res, "Invalid or expired reset token");
        return;
      }

      // Verify token type
      if (payload.type !== "password-reset") {
        errors.badRequest(res, "Invalid token type");
        return;
      }

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          id: payload.userId,
          email: payload.email,
          deletedAt: null,
        },
      });

      if (!user) {
        errors.notFound(res, "User not found");
        return;
      }

      // Check if user has a password (not OAuth-only)
      if (!user.passwordHash) {
        errors.badRequest(
          res,
          "This account does not have a password. Please use OAuth login."
        );
        return;
      }

      // Hash new password
      const passwordHash = await passwordService.hash(data.password);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Revoke all refresh tokens for security
      await tokenService.revokeAllUserTokens(user.id);

      // Generate new tokens so user is automatically logged in
      const tokens = await tokenService.generateTokenPair(
        user.id,
        user.email,
        user.role
      );

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: "Password reset successful.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Reset password error:", error);
        errors.internal(res, "Failed to reset password");
      }
    }
  }

  /**
   * POST /auth/change-password
   * Change password for authenticated user
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errors.unauthorized(res);
        return;
      }

      const data = validate(changePasswordSchema, req.body);

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user || !user.passwordHash) {
        errors.notFound(res, "User not found");
        return;
      }

      // Verify current password
      const isValid = await passwordService.verify(
        user.passwordHash,
        data.currentPassword
      );
      if (!isValid) {
        errors.unauthorized(res, "Current password is incorrect");
        return;
      }

      // Hash new password
      const passwordHash = await passwordService.hash(data.newPassword);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Revoke all refresh tokens for security
      await tokenService.revokeAllUserTokens(user.id);

      successResponse(res, { message: "Password changed successfully" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Change password error:", error);
        errors.internal(res, "Failed to change password");
      }
    }
  }

  /**
   * POST /auth/verify-email
   * Verify email with token (placeholder - implement email verification if needed)
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      validate(verifyEmailSchema, req.body);

      // TODO: Implement email verification logic
      // For now, return success as this might not be implemented yet
      successResponse(res, {
        message: "Email verification is not yet implemented",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Verify email error:", error);
        errors.internal(res, "Email verification failed");
      }
    }
  }

  /**
   * POST /auth/resend-verification
   * Resend verification email (placeholder - implement if needed)
   */
  async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      validate(resendVerificationSchema, req.body);

      // TODO: Implement resend verification email logic
      // For now, return success as this might not be implemented yet
      successResponse(res, {
        message: "Verification email resend is not yet implemented",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, "Validation failed", error.issues);
      } else {
        console.error("Resend verification error:", error);
        errors.internal(res, "Failed to resend verification email");
      }
    }
  }
}

export const authController = new AuthController();
