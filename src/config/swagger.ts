import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "FinWise Backend API",
    version: "1.0.0",
    description:
      "FinWise Backend API documentation for financial management application. Supports parent and child user accounts with OAuth authentication.",
    contact: {
      name: "FinWise Support",
    },
  },
  servers: [
    {
      url: process.env.API_URL || "http://localhost:3000",
      description: process.env.NODE_ENV === "production"
        ? "Production server"
        : "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT access token",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          ok: {
            type: "boolean",
            description: "Indicates if the request was successful",
          },
          data: {
            type: "object",
            description: "Response data",
          },
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "Error code",
              },
              message: {
                type: "string",
                description: "Error message",
              },
              details: {
                type: "object",
                description: "Additional error details",
              },
            },
          },
        },
      },
      SignupRequest: {
        type: "object",
        required: ["role", "name", "email", "password"],
        discriminator: {
          propertyName: "role",
        },
        oneOf: [
          {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["PARENT"],
                description: "User role",
              },
              name: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                description: "User's full name",
              },
              email: {
                type: "string",
                format: "email",
                description: "Email address (will be converted to lowercase)",
              },
              password: {
                type: "string",
                minLength: 8,
                maxLength: 100,
                description: "Password (min 8 characters)",
              },
              country: {
                type: "string",
                pattern: "^[A-Z]{2}$",
                description: "ISO-2 country code",
              },
              numberOfChildren: {
                type: "integer",
                minimum: 0,
                maximum: 20,
                description: "Number of children",
              },
              monthlyIncomeBase: {
                type: "number",
                minimum: 0,
                description: "Monthly income",
              },
              monthlyRentBase: {
                type: "number",
                minimum: 0,
                description: "Monthly rent (optional)",
              },
              monthlyLoansBase: {
                type: "number",
                minimum: 0,
                description: "Monthly loan payments (optional)",
              },
              otherNotes: {
                type: "string",
                maxLength: 1000,
                description: "Additional notes (optional)",
              },
              idImage: {
                type: "string",
                format: "binary",
                description: "ID document image file (required for PARENT, max 5MB)",
              },
            },
            required: [
              "role",
              "name",
              "email",
              "password",
              "country",
              "numberOfChildren",
              "monthlyIncomeBase",
            ],
          },
          {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["CHILD"],
                description: "User role",
              },
              name: {
                type: "string",
                minLength: 1,
                maxLength: 100,
                description: "User's full name",
              },
              email: {
                type: "string",
                format: "email",
                description: "Email address (will be converted to lowercase)",
              },
              password: {
                type: "string",
                minLength: 8,
                maxLength: 100,
                description: "Password (min 8 characters)",
              },
            },
            required: ["role", "name", "email", "password"],
          },
        ],
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "Email address",
          },
          password: {
            type: "string",
            minLength: 1,
            description: "Password",
          },
        },
      },
      OAuthRequest: {
        type: "object",
        required: ["provider", "idToken"],
        properties: {
          provider: {
            type: "string",
            enum: ["google", "apple"],
            description: "OAuth provider",
          },
          idToken: {
            type: "string",
            description: "OAuth ID token from provider",
          },
        },
      },
      RefreshTokenRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            description: "Refresh token",
          },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            description: "Email address",
          },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: {
            type: "string",
            description: "Password reset token from email",
          },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 100,
            description: "New password",
          },
        },
      },
      LogoutRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            description: "Refresh token to revoke",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "User ID",
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address",
          },
          name: {
            type: "string",
            description: "User's full name",
          },
          role: {
            type: "string",
            enum: ["PARENT", "CHILD"],
            description: "User role",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Account creation timestamp",
          },
        },
      },
      TokenPair: {
        type: "object",
        properties: {
          accessToken: {
            type: "string",
            description: "JWT access token (short-lived)",
          },
          refreshToken: {
            type: "string",
            description: "JWT refresh token (long-lived)",
          },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: {
            $ref: "#/components/schemas/User",
          },
          verificationStatus: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
            description: "Account verification status",
          },
          tokens: {
            $ref: "#/components/schemas/TokenPair",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          ok: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                example: "BAD_REQUEST",
              },
              message: {
                type: "string",
                example: "Validation failed",
              },
              details: {
                type: "object",
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Authentication",
      description: "User authentication endpoints",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Health",
      description: "API health check endpoints",
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

