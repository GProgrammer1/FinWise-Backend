import { z } from 'zod';

// Email/password validation
export const emailSchema = z.string().email().toLowerCase();
export const passwordSchema = z.string().min(8).max(100);

// Signup validation
export const signupSchema = z.discriminatedUnion('role', [
  // Parent signup
  z.object({
    role: z.literal('PARENT'),
    name: z.string().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
    country: z.string().length(2), // ISO-2 country code
    numberOfChildren: z.number().int().min(0).max(20),
    monthlyIncomeBase: z.number().positive(),
    monthlyRentBase: z.number().nonnegative().optional(),
    monthlyLoansBase: z.number().nonnegative().optional(),
    otherNotes: z.string().max(1000).optional(),
  }),
  // Child signup
  z.object({
    role: z.literal('CHILD'),
    name: z.string().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
  }),
]);

export type SignupInput = z.infer<typeof signupSchema>;

// Login validation
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// OAuth validation
export const oauthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1),
});

export type OAuthInput = z.infer<typeof oauthSchema>;

// Refresh token validation
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// Forgot password validation
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset password validation
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Verify email validation
export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Resend verification validation
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// Helper to validate request body
export function validate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown
): z.infer<TSchema> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Re-throw with formatted errors
      throw error;
    }
    throw error;
  }
}
