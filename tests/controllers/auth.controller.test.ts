import { Request, Response } from "express";
import { AuthController } from "../../src/controllers/auth.controller";
import prisma from "../../src/config/database";
import { passwordService } from "../../src/services/auth/password.service";
import { tokenService } from "../../src/services/auth/token.service";
import { uploadService } from "../../src/services/upload.service";
import { mailerService } from "../../src/services/mailer.service";

// Mock dependencies
jest.mock("../../src/config/database", () => {
  return {
    __esModule: true,
    default: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      verificationRequest: {
        create: jest.fn(),
      },
      parentProfile: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    },
  };
});

jest.mock("../../src/services/auth/password.service", () => ({
  passwordService: {
    hash: jest.fn(),
    verify: jest.fn(),
    needsRehash: jest.fn().mockReturnValue(false),
  },
}));

jest.mock("../../src/services/auth/token.service", () => ({
  tokenService: {
    generateTokenPair: jest.fn(),
    refreshTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
  },
}));

jest.mock("../../src/services/upload.service", () => ({
  uploadService: {
    uploadFile: jest.fn(),
  },
}));

jest.mock("../../src/services/mailer.service", () => ({
  mailerService: {
    sendParentWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendChildWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendParentSignupNotificationToAdmin: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("AuthController - Signup", () => {
  let controller: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonResponse: any;
  let statusCode: number;

  beforeEach(() => {
    controller = new AuthController();
    jsonResponse = null;
    statusCode = 0;

    mockResponse = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return mockResponse as Response;
      }),
      json: jest.fn().mockImplementation((data) => {
        jsonResponse = data;
        return mockResponse as Response;
      }),
    };

    mockRequest = {
      body: {},
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("POST /auth/signup - Parent Signup", () => {
    const parentSignupData = {
      role: "PARENT",
      name: "John Doe",
      email: "parent@example.com",
      password: "password123",
      country: "US",
      numberOfChildren: "2",
      monthlyIncomeBase: "5000",
      monthlyRentBase: "1500",
      monthlyLoansBase: "300",
    };

    const mockFile = {
      fieldname: "idImage",
      originalname: "id-image.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: 102400,
      buffer: Buffer.from("fake-image-data"),
      destination: "",
      filename: "",
      path: "",
    };

    it("should successfully signup parent with ID image and send admin notification", async () => {
      // Mock: User doesn't exist
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock: Password hashing
      (passwordService.hash as jest.Mock).mockResolvedValue("hashed-password");

      // Mock: File upload
      (uploadService.uploadFile as jest.Mock).mockResolvedValue({
        url: "https://example.com/uploads/id-image.jpg",
        path: "id-verification/image.jpg",
        size: 102400,
        mimeType: "image/jpeg",
      });

      // Mock: Database transaction
      const mockUser = {
        id: "user-123",
        email: "parent@example.com",
        name: "John Doe",
        role: "PARENT",
        createdAt: new Date(),
      };

      const mockVerificationRequest = {
        id: "verification-123",
        userId: "user-123",
        role: "PARENT",
        status: "PENDING",
        idImageUrl: "https://example.com/uploads/id-image.jpg",
      };

      const mockParentProfile = {
        id: "profile-123",
        userId: "user-123",
        country: "US",
        numberOfChildren: 2,
        monthlyIncomeBase: 5000,
        monthlyRentBase: 1500,
        monthlyLoansBase: 300,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          verificationRequest: {
            create: jest.fn().mockResolvedValue(mockVerificationRequest),
          },
          parentProfile: {
            create: jest.fn().mockResolvedValue(mockParentProfile),
          },
        };
        return callback(tx);
      });

      // Mock: Token generation
      (tokenService.generateTokenPair as jest.Mock).mockResolvedValue({
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
      });

      // Mock: Email services
      (mailerService.sendParentWelcomeEmail as jest.Mock).mockResolvedValue(
        undefined
      );
      (mailerService.sendParentSignupNotificationToAdmin as jest.Mock).mockResolvedValue(
        undefined
      );

      // Setup request
      mockRequest.body = parentSignupData;
      mockRequest.file = mockFile as Express.Multer.File;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "parent@example.com" },
      });

      expect(passwordService.hash).toHaveBeenCalledWith("password123");

      expect(uploadService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldname: "idImage",
          originalname: "id-image.jpg",
        }),
        "id-verification"
      );

      expect(mailerService.sendParentWelcomeEmail).toHaveBeenCalledWith(
        "parent@example.com",
        "John Doe"
      );

      expect(
        mailerService.sendParentSignupNotificationToAdmin
      ).toHaveBeenCalledWith(
        "parent@example.com",
        "John Doe",
        "user-123",
        expect.any(Buffer),
        "id-image.jpg"
      );

      expect(statusCode).toBe(201);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.user.email).toBe("parent@example.com");
      expect(jsonResponse.data.verificationStatus).toBe("PENDING");
      expect(jsonResponse.data.accessToken).toBe("access-token-123");
      expect(jsonResponse.data.refreshToken).toBe("refresh-token-123");
    });

    it("should reject parent signup without ID image", async () => {
      // Mock: User doesn't exist
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Setup request without file
      mockRequest.body = parentSignupData;
      mockRequest.file = undefined;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(415); // Unsupported Media Type
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toContain("ID image is required");
      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(mailerService.sendParentSignupNotificationToAdmin).not.toHaveBeenCalled();
    });

    it("should reject parent signup with existing email", async () => {
      // Mock: User already exists
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user",
        email: "parent@example.com",
      });

      mockRequest.body = parentSignupData;
      mockRequest.file = mockFile as Express.Multer.File;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(409); // Conflict
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toContain("already registered");
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it("should create verification request with PENDING status", async () => {
      // Mock: User doesn't exist
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue("hashed-password");
      (uploadService.uploadFile as jest.Mock).mockResolvedValue({
        url: "https://example.com/uploads/id-image.jpg",
        path: "id-verification/image.jpg",
        size: 102400,
        mimeType: "image/jpeg",
      });

      const mockUser = {
        id: "user-123",
        email: "parent@example.com",
        name: "John Doe",
        role: "PARENT",
        createdAt: new Date(),
      };

      let verificationRequestData: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          verificationRequest: {
            create: jest.fn().mockImplementation(async (data: any) => {
              verificationRequestData = data.data;
              return {
                id: "verification-123",
                ...verificationRequestData,
              };
            }),
          },
          parentProfile: {
            create: jest.fn().mockResolvedValue({ id: "profile-123" }),
          },
        };
        return callback(tx);
      });

      (tokenService.generateTokenPair as jest.Mock).mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      (mailerService.sendParentWelcomeEmail as jest.Mock).mockResolvedValue(
        undefined
      );
      (mailerService.sendParentSignupNotificationToAdmin as jest.Mock).mockResolvedValue(
        undefined
      );

      mockRequest.body = parentSignupData;
      mockRequest.file = mockFile as Express.Multer.File;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(verificationRequestData.status).toBe("PENDING");
      expect(verificationRequestData.role).toBe("PARENT");
      expect(verificationRequestData.idImageUrl).toBe(
        "https://example.com/uploads/id-image.jpg"
      );
    });
  });

  describe("POST /auth/signup - Child Signup", () => {
    const childSignupData = {
      role: "CHILD",
      name: "Jane Doe",
      email: "child@example.com",
      password: "password123",
    };

    it("should successfully signup child without ID image", async () => {
      // Mock: User doesn't exist
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue("hashed-password");

      const mockUser = {
        id: "user-456",
        email: "child@example.com",
        name: "Jane Doe",
        role: "CHILD",
        createdAt: new Date(),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          verificationRequest: {
            create: jest.fn().mockResolvedValue({
              id: "verification-456",
              userId: "user-456",
              role: "CHILD",
              status: "PENDING",
            }),
          },
        };
        return callback(tx);
      });

      (tokenService.generateTokenPair as jest.Mock).mockResolvedValue({
        accessToken: "access-token-456",
        refreshToken: "refresh-token-456",
      });

      (mailerService.sendChildWelcomeEmail as jest.Mock).mockResolvedValue(
        undefined
      );

      mockRequest.body = childSignupData;
      mockRequest.file = undefined;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(201);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.user.role).toBe("CHILD");
      expect(mailerService.sendChildWelcomeEmail).toHaveBeenCalledWith(
        "child@example.com",
        "Jane Doe"
      );
      expect(
        mailerService.sendParentSignupNotificationToAdmin
      ).not.toHaveBeenCalled();
      expect(uploadService.uploadFile).not.toHaveBeenCalled();
    });

    it("should reject child signup with existing email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-child",
        email: "child@example.com",
      });

      mockRequest.body = childSignupData;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(409);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message).toContain("already registered");
    });
  });

  describe("POST /auth/signup - Validation", () => {
    it("should reject invalid signup data", async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockRequest.body = {
        role: "PARENT",
        name: "", // Invalid: empty name
        email: "invalid-email", // Invalid email format
        password: "short", // Invalid: too short
        country: "US",
        numberOfChildren: "2",
        monthlyIncomeBase: "5000",
      };

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBeDefined();
      expect(jsonResponse.error?.code).toBe("BAD_REQUEST");
      expect(jsonResponse.message || jsonResponse.error?.message).toContain("Validation failed");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle database errors gracefully", async () => {
      // Mock console.error to capture it
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordService.hash as jest.Mock).mockResolvedValue("hashed-password");
      (uploadService.uploadFile as jest.Mock).mockResolvedValue({
        url: "https://example.com/uploads/id-image.jpg",
        path: "id-verification/image.jpg",
        size: 102400,
        mimeType: "image/jpeg",
      });

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const mockFile = {
        fieldname: "idImage",
        originalname: "id-image.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 102400,
        buffer: Buffer.from("fake-image-data"),
        destination: "",
        filename: "",
        path: "",
      };

      mockRequest.body = {
        role: "PARENT",
        name: "John Doe",
        email: "parent@example.com",
        password: "password123",
        country: "US",
        numberOfChildren: "2",
        monthlyIncomeBase: "5000",
      };
      mockRequest.file = mockFile as Express.Multer.File;

      // Execute
      await controller.signup(mockRequest as Request, mockResponse as Response);

      // Assertions
      expect(statusCode).toBe(500);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.message || jsonResponse.error?.message).toContain("Signup failed");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

