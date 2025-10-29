import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { passwordService } from '../services/auth/password.service';
import { tokenService } from '../services/auth/token.service';
import { oauthService } from '../services/auth/oauth.service';
import { uploadService } from '../services/upload.service';
import { mailerService } from '../services/mailer.service';
import { signupSchema, loginSchema, oauthSchema, refreshSchema, validate } from '../validators/auth.validator';
import { successResponse, errors } from '../utils/response';

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
        numberOfChildren: req.body.numberOfChildren ? parseInt(req.body.numberOfChildren) : undefined,
        monthlyIncomeBase: req.body.monthlyIncomeBase ? parseFloat(req.body.monthlyIncomeBase) : undefined,
        monthlyRentBase: req.body.monthlyRentBase ? parseFloat(req.body.monthlyRentBase) : undefined,
        monthlyLoansBase: req.body.monthlyLoansBase ? parseFloat(req.body.monthlyLoansBase) : undefined,
      };

      const data = validate(signupSchema, body);

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        errors.conflict(res, 'Email already registered');
        return;
      }

      // For PARENT, require ID image upload
      if (data.role === 'PARENT' && !req.file) {
        errors.unsupportedMedia(res, 'ID image is required for parent accounts');
        return;
      }

      // Hash password
      const passwordHash = await passwordService.hash(data.password);

      // Upload ID image if provided
      let idImageUrl: string | undefined;
      if (req.file) {
        const uploadResult = await uploadService.uploadFile(req.file, 'id-verification');
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
            status: 'PENDING',
            idImageUrl,
          },
        });

        // Create parent profile if role is PARENT
        let parentProfile;
        if (data.role === 'PARENT') {
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
      if (data.role === 'PARENT') {
        await mailerService.sendParentWelcomeEmail(result.user.email, result.user.name);
      } else {
        await mailerService.sendChildWelcomeEmail(result.user.email, result.user.name);
      }

      successResponse(res, {
        user: result.user,
        verificationStatus: result.verificationRequest.status,
        tokens,
      }, 201);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, 'Validation failed', error.issues);
      } else {
        console.error('Signup error:', error);
        errors.internal(res, 'Signup failed');
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
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user || !user.passwordHash) {
        errors.unauthorized(res, 'Invalid email or password');
        return;
      }

      // Verify password (constant-time)
      const isValid = await passwordService.verify(user.passwordHash, data.password);
      if (!isValid) {
        errors.unauthorized(res, 'Invalid email or password');
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
      const tokens = await tokenService.generateTokenPair(user.id, user.email, user.role);

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        verificationStatus: user.verificationRequests[0]?.status || 'PENDING',
        tokens,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, 'Validation failed', error.issues);
      } else {
        console.error('Login error:', error);
        errors.internal(res, 'Login failed');
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
      
      if (data.provider === 'google') {
        oauthPayload = await oauthService.verifyGoogleToken(data.idToken);
      } else {
        oauthPayload = await oauthService.verifyAppleToken(data.idToken);
      }

      if (!oauthPayload.email) {
        errors.badRequest(res, 'Email not provided by OAuth provider');
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
                orderBy: { createdAt: 'desc' },
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
              orderBy: { createdAt: 'desc' },
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
                name: oauthPayload.name || oauthPayload.email!.split('@')[0],
                role: 'PARENT', // Default to PARENT for OAuth
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
                role: 'PARENT',
                status: 'PENDING',
              },
            });

            return newUser;
          });

          // Send welcome email
          await mailerService.sendParentWelcomeEmail(user.email, user.name);
        }
      }

      // Generate tokens
      const tokens = await tokenService.generateTokenPair(user.id, user.email, user.role);

      successResponse(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        verificationStatus: user.verificationRequests[0]?.status || 'PENDING',
        tokens,
        isNewUser,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, 'Validation failed', error.issues);
      } else if (error.message.includes('Invalid')) {
        errors.unauthorized(res, error.message);
      } else {
        console.error('OAuth error:', error);
        errors.internal(res, 'OAuth authentication failed');
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

      successResponse(res, { tokens });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, 'Validation failed', error.issues);
      } else {
        errors.unauthorized(res, error.message || 'Token refresh failed');
      }
    }
  }

  /**
   * POST /auth/logout
   * Revoke refresh token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const data = validate(refreshSchema, req.body);

      await tokenService.revokeRefreshToken(data.refreshToken);

      successResponse(res, { message: 'Logged out successfully' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        errors.badRequest(res, 'Validation failed', error.issues);
      } else {
        errors.internal(res, 'Logout failed');
      }
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
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          parentProfile: true,
        },
      });

      if (!user) {
        errors.notFound(res, 'User not found');
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
        verificationStatus: user.verificationRequests[0]?.status || 'PENDING',
        parentProfile: user.parentProfile ? {
          country: user.parentProfile.country,
          numberOfChildren: user.parentProfile.numberOfChildren,
          monthlyIncomeBase: user.parentProfile.monthlyIncomeBase,
          monthlyRentBase: user.parentProfile.monthlyRentBase,
          monthlyLoansBase: user.parentProfile.monthlyLoansBase,
        } : null,
      });
    } catch (error: any) {
      console.error('Get user error:', error);
      errors.internal(res, 'Failed to get user profile');
    }
  }
}

export const authController = new AuthController();
