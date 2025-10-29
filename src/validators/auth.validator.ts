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

// Helper to validate request body
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
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
