import { tokenService } from "../../src/services/auth/token.service";
import { jwtService } from "../../src/services/auth/jwt.service";
import prisma from "../../src/config/database";

// Mock dependencies
jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/auth/jwt.service");

describe("TokenService", () => {
  const mockPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateTokenPair", () => {
    it("should generate access and refresh token pair", async () => {
      const userId = "user-123";
      const email = "test@example.com";
      const role = "PARENT";
      const tokenId = "token-456";
      const accessToken = "access-token";
      const refreshToken = "refresh-token";
      const tokenHash = "hashed-token";
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Mock JWT service
      jest
        .spyOn(jwtService, "generateAccessToken")
        .mockReturnValue(accessToken);
      jest
        .spyOn(jwtService, "generateRefreshToken")
        .mockReturnValue(refreshToken);
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      jest
        .spyOn(jwtService, "getRefreshTokenExpiration")
        .mockReturnValue(expiresAt);

      // Mock Prisma
      (mockPrisma as any).refreshToken = {
        create: jest.fn().mockResolvedValue({
          id: tokenId,
          userId,
          tokenHash,
          expiresAt,
        }),
      };

      const result = await tokenService.generateTokenPair(userId, email, role);

      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith({
        userId,
        email,
        role,
      });
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith({
        userId,
        tokenId: expect.any(String),
      });
      expect((mockPrisma as any).refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          tokenHash,
          expiresAt,
        }),
      });
    });
  });

  describe("refreshTokens", () => {
    it("should refresh tokens with rotation", async () => {
      const refreshToken = "old-refresh-token";
      const tokenHash = "hashed-token";
      const tokenId = "token-123";
      const userId = "user-123";
      const email = "test@example.com";
      const role = "PARENT";

      const storedToken = {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: {
          id: userId,
          email,
          role,
          deletedAt: null,
        },
      };

      // Mock JWT service
      jest.spyOn(jwtService, "verifyRefreshToken").mockReturnValue({
        userId,
        tokenId,
      });
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      jest
        .spyOn(jwtService, "generateAccessToken")
        .mockReturnValue("new-access-token");
      jest
        .spyOn(jwtService, "generateRefreshToken")
        .mockReturnValue("new-refresh-token");
      jest
        .spyOn(jwtService, "getRefreshTokenExpiration")
        .mockReturnValue(new Date());

      // Mock Prisma
      (mockPrisma as any).refreshToken = {
        findUnique: jest.fn().mockResolvedValue(storedToken),
        update: jest.fn().mockResolvedValue(storedToken),
        create: jest.fn().mockResolvedValue({
          id: "new-token-id",
          userId,
          tokenHash: "new-hash",
          expiresAt: new Date(),
        }),
      };

      const result = await tokenService.refreshTokens(refreshToken);

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("new-refresh-token");
      expect((mockPrisma as any).refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should throw error if token not found", async () => {
      const refreshToken = "invalid-token";
      const tokenHash = "hashed-token";

      jest.spyOn(jwtService, "verifyRefreshToken").mockReturnValue({
        userId: "user-123",
        tokenId: "token-123",
      });
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      (mockPrisma as any).refreshToken = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(tokenService.refreshTokens(refreshToken)).rejects.toThrow(
        "Invalid refresh token"
      );
    });

    it("should throw error if token is revoked", async () => {
      const refreshToken = "revoked-token";
      const tokenHash = "hashed-token";
      const storedToken = {
        id: "token-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
        user: {
          id: "user-123",
          email: "test@example.com",
          role: "PARENT",
          deletedAt: null,
        },
      };

      jest.spyOn(jwtService, "verifyRefreshToken").mockReturnValue({
        userId: "user-123",
        tokenId: "token-123",
      });
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      (mockPrisma as any).refreshToken = {
        findUnique: jest.fn().mockResolvedValue(storedToken),
      };

      await expect(tokenService.refreshTokens(refreshToken)).rejects.toThrow(
        "Refresh token has been revoked"
      );
    });

    it("should throw error if token is expired", async () => {
      const refreshToken = "expired-token";
      const tokenHash = "hashed-token";
      const storedToken = {
        id: "token-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        user: {
          id: "user-123",
          email: "test@example.com",
          role: "PARENT",
          deletedAt: null,
        },
      };

      jest.spyOn(jwtService, "verifyRefreshToken").mockReturnValue({
        userId: "user-123",
        tokenId: "token-123",
      });
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      (mockPrisma as any).refreshToken = {
        findUnique: jest.fn().mockResolvedValue(storedToken),
      };

      await expect(tokenService.refreshTokens(refreshToken)).rejects.toThrow(
        "Refresh token has expired"
      );
    });

    it("should throw error if user is deleted", async () => {
      const refreshToken = "valid-token";
      const tokenHash = "hashed-token";
      const storedToken = {
        id: "token-123",
        userId: "user-123",
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        user: {
          id: "user-123",
          email: "test@example.com",
          role: "PARENT",
          deletedAt: new Date(),
        },
      };

      jest.spyOn(jwtService, "verifyRefreshToken").mockReturnValue({
        userId: "user-123",
        tokenId: "token-123",
      });
      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      (mockPrisma as any).refreshToken = {
        findUnique: jest.fn().mockResolvedValue(storedToken),
      };

      await expect(tokenService.refreshTokens(refreshToken)).rejects.toThrow(
        "User account has been deleted"
      );
    });
  });

  describe("revokeRefreshToken", () => {
    it("should revoke a refresh token", async () => {
      const refreshToken = "token-to-revoke";
      const tokenHash = "hashed-token";

      jest.spyOn(jwtService, "hashToken").mockReturnValue(tokenHash);
      (mockPrisma as any).refreshToken = {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };

      await tokenService.revokeRefreshToken(refreshToken);

      expect((mockPrisma as any).refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all tokens for a user", async () => {
      const userId = "user-123";

      (mockPrisma as any).refreshToken = {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      };

      await tokenService.revokeAllUserTokens(userId);

      expect((mockPrisma as any).refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired tokens", async () => {
      (mockPrisma as any).refreshToken = {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      };

      const count = await tokenService.cleanupExpiredTokens();

      expect(count).toBe(5);
      expect((mockPrisma as any).refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            {
              revokedAt: {
                not: null,
                lt: expect.any(Date),
              },
            },
          ],
        },
      });
    });
  });
});
