import { Request, Response, NextFunction } from "express";
import {
  requireAuth,
  requireRole,
  optionalAuth,
} from "../../src/middleware/auth.middleware";
import { jwtService } from "../../src/services/auth/jwt.service";
import prisma from "../../src/config/database";

// Mock dependencies
jest.mock("../../src/services/auth/jwt.service");
jest.mock("../../src/config/database", () => {
  const mockUser = {
    findFirst: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      user: mockUser,
    },
  };
});

describe("Auth Middleware", () => {
  let mockRequest: Partial<Request> & {
    user?: { id: string; email: string; role: string };
  };
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonResponse: any;
  let statusCode: number;

  const mockJwtService = jwtService as jest.Mocked<typeof jwtService>;
  const mockPrisma = prisma as any;

  beforeEach(() => {
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

    mockNext = jest.fn();
    mockRequest = {
      headers: {},
    } as Partial<Request> & {
      user?: { id: string; email: string; role: string };
    };

    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("should allow authenticated request", async () => {
      const token = "valid-token";
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtService.verifyAccessToken = jest.fn().mockReturnValue(payload);
      (mockPrisma as any).user = {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-123",
          email: "test@example.com",
          role: "PARENT",
        }),
      };

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        id: "user-123",
        email: "test@example.com",
        role: "PARENT",
      });
    });

    it("should reject request without authorization header", async () => {
      mockRequest.headers = {};

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toBe(
        "Missing or invalid authorization header"
      );
    });

    it("should reject request with invalid authorization format", async () => {
      mockRequest.headers = {
        authorization: "InvalidFormat token",
      };

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      mockJwtService.verifyAccessToken = jest.fn().mockImplementation(() => {
        const error = new Error("Invalid token");
        (error as any).name = "JsonWebTokenError";
        throw error;
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toBe("Invalid token");
    });

    it("should reject request with expired token", async () => {
      mockRequest.headers = {
        authorization: "Bearer expired-token",
      };

      mockJwtService.verifyAccessToken = jest.fn().mockImplementation(() => {
        const error = new Error("Token expired");
        (error as any).name = "TokenExpiredError";
        throw error;
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toBe("Token expired");
    });

    it("should reject request if user not found", async () => {
      const token = "valid-token";
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtService.verifyAccessToken = jest.fn().mockReturnValue(payload);
      (mockPrisma as any).user = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toBe("User not found or deleted");
    });

    it("should reject request if user is deleted", async () => {
      const token = "valid-token";
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtService.verifyAccessToken = jest.fn().mockReturnValue(payload);
      (mockPrisma as any).user = {
        findFirst: jest.fn().mockResolvedValue(null),
      }; // Deleted users won't be found

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
    });
  });

  describe("requireRole", () => {
    it("should allow request with required role", () => {
      mockRequest.user = {
        id: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      const middleware = requireRole("PARENT");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow request with one of multiple required roles", () => {
      mockRequest.user = {
        id: "user-123",
        email: "test@example.com",
        role: "CHILD",
      };

      const middleware = requireRole("PARENT", "CHILD");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject request without user", () => {
      mockRequest.user = undefined;

      const middleware = requireRole("PARENT");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(401);
      expect(jsonResponse.error.message).toBe("Authentication required");
    });

    it("should reject request with wrong role", () => {
      mockRequest.user = {
        id: "user-123",
        email: "test@example.com",
        role: "CHILD",
      };

      const middleware = requireRole("PARENT");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(jsonResponse.error.message).toContain("Requires one of: PARENT");
    });
  });

  describe("optionalAuth", () => {
    it("should set user if valid token provided", async () => {
      const token = "valid-token";
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtService.verifyAccessToken = jest.fn().mockReturnValue(payload);
      (mockPrisma as any).user = {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-123",
          email: "test@example.com",
          role: "PARENT",
        }),
      };

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        id: "user-123",
        email: "test@example.com",
        role: "PARENT",
      });
    });

    it("should continue if no authorization header", async () => {
      mockRequest.headers = {};

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it("should continue if invalid token (not throw)", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      mockJwtService.verifyAccessToken = jest.fn().mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it("should continue if user not found", async () => {
      const token = "valid-token";
      const payload = {
        userId: "user-123",
        email: "test@example.com",
        role: "PARENT",
      };

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockJwtService.verifyAccessToken = jest.fn().mockReturnValue(payload);
      (mockPrisma as any).user = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await optionalAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });
  });
});
