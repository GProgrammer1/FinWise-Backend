import { z } from "zod";
import {
  signupSchema,
  loginSchema,
  oauthSchema,
  refreshSchema,
  validate,
  emailSchema,
  passwordSchema,
} from "../../src/validators/auth.validator";

describe("Auth Validators", () => {
  describe("emailSchema", () => {
    it("should accept valid email", () => {
      expect(() => emailSchema.parse("test@example.com")).not.toThrow();
    });

    it("should convert email to lowercase", () => {
      const result = emailSchema.parse("Test@Example.COM");
      expect(result).toBe("test@example.com");
    });

    it("should reject invalid email", () => {
      expect(() => emailSchema.parse("invalid-email")).toThrow();
    });
  });

  describe("passwordSchema", () => {
    it("should accept valid password (8-100 chars)", () => {
      expect(() => passwordSchema.parse("password123")).not.toThrow();
    });

    it("should reject password shorter than 8 chars", () => {
      expect(() => passwordSchema.parse("short")).toThrow();
    });

    it("should reject password longer than 100 chars", () => {
      const longPassword = "a".repeat(101);
      expect(() => passwordSchema.parse(longPassword)).toThrow();
    });
  });

  describe("signupSchema", () => {
    describe("PARENT role", () => {
      it("should accept valid parent signup", () => {
        const data = {
          role: "PARENT",
          name: "John Doe",
          email: "parent@example.com",
          password: "password123",
          country: "US",
          numberOfChildren: 2,
          monthlyIncomeBase: 5000,
          monthlyRentBase: 1500,
          monthlyLoansBase: 300,
          otherNotes: "Some notes",
        };

        expect(() => signupSchema.parse(data)).not.toThrow();
      });

      it("should accept parent signup with optional fields missing", () => {
        const data = {
          role: "PARENT",
          name: "John Doe",
          email: "parent@example.com",
          password: "password123",
          country: "US",
          numberOfChildren: 0,
          monthlyIncomeBase: 5000,
        };

        expect(() => signupSchema.parse(data)).not.toThrow();
      });

      it("should reject parent signup with invalid country code", () => {
        const data = {
          role: "PARENT",
          name: "John Doe",
          email: "parent@example.com",
          password: "password123",
          country: "USA",
          numberOfChildren: 2,
          monthlyIncomeBase: 5000,
        };

        expect(() => signupSchema.parse(data)).toThrow();
      });

      it("should reject parent signup with negative income", () => {
        const data = {
          role: "PARENT",
          name: "John Doe",
          email: "parent@example.com",
          password: "password123",
          country: "US",
          numberOfChildren: 2,
          monthlyIncomeBase: -100,
        };

        expect(() => signupSchema.parse(data)).toThrow();
      });

      it("should reject parent signup with invalid children count", () => {
        const data = {
          role: "PARENT",
          name: "John Doe",
          email: "parent@example.com",
          password: "password123",
          country: "US",
          numberOfChildren: 25,
          monthlyIncomeBase: 5000,
        };

        expect(() => signupSchema.parse(data)).toThrow();
      });
    });

    describe("CHILD role", () => {
      it("should accept valid child signup", () => {
        const data = {
          role: "CHILD",
          name: "Jane Doe",
          email: "child@example.com",
          password: "password123",
        };

        expect(() => signupSchema.parse(data)).not.toThrow();
      });

      it("should accept child signup even with extra fields (Zod strips unknown)", () => {
        const data = {
          role: "CHILD",
          name: "Jane Doe",
          email: "child@example.com",
          password: "password123",
          country: "US", // Extra field, but Zod will ignore it
        };

        // Zod discriminated union will match CHILD schema and ignore extra fields
        const result = signupSchema.parse(data);
        expect(result.role).toBe("CHILD");
        expect(result.name).toBe("Jane Doe");
        // Country should not be in result as it's not part of CHILD schema
        expect("country" in result).toBe(false);
      });
    });
  });

  describe("loginSchema", () => {
    it("should accept valid login data", () => {
      const data = {
        email: "test@example.com",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it("should reject login with invalid email", () => {
      const data = {
        email: "invalid-email",
        password: "password123",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });

    it("should reject login with empty password", () => {
      const data = {
        email: "test@example.com",
        password: "",
      };

      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  describe("oauthSchema", () => {
    it("should accept valid Google OAuth data", () => {
      const data = {
        provider: "google",
        idToken: "valid-token-123",
      };

      expect(() => oauthSchema.parse(data)).not.toThrow();
    });

    it("should accept valid Apple OAuth data", () => {
      const data = {
        provider: "apple",
        idToken: "valid-token-123",
      };

      expect(() => oauthSchema.parse(data)).not.toThrow();
    });

    it("should reject invalid provider", () => {
      const data = {
        provider: "facebook",
        idToken: "valid-token-123",
      };

      expect(() => oauthSchema.parse(data)).toThrow();
    });

    it("should reject empty idToken", () => {
      const data = {
        provider: "google",
        idToken: "",
      };

      expect(() => oauthSchema.parse(data)).toThrow();
    });
  });

  describe("refreshSchema", () => {
    it("should accept valid refresh token data", () => {
      const data = {
        refreshToken: "valid-refresh-token-123",
      };

      expect(() => refreshSchema.parse(data)).not.toThrow();
    });

    it("should reject empty refresh token", () => {
      const data = {
        refreshToken: "",
      };

      expect(() => refreshSchema.parse(data)).toThrow();
    });
  });

  describe("validate function", () => {
    it("should return validated data", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const data = { name: "John", age: 30 };
      const result = validate(schema, data);

      expect(result.name).toBe("John");
      expect(result.age).toBe(30);
    });

    it("should throw ZodError for invalid data", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const data = { name: "John", age: "thirty" };

      expect(() => validate(schema, data)).toThrow(z.ZodError);
    });

    it("should preserve type inference", () => {
      const schema = loginSchema;
      const data = { email: "test@example.com", password: "pass123" };

      const result = validate(schema, data);

      // TypeScript should infer the correct type
      expect(result.email).toBe("test@example.com");
      expect(result.password).toBe("pass123");
    });
  });
});
