import { OAuthService } from "../../src/services/auth/oauth.service";
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";

// Mock dependencies
jest.mock("google-auth-library");
jest.mock("apple-signin-auth");

describe("OAuthService", () => {
  let oauthService: OAuthService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyGoogleToken", () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID =
        "test-client-id.apps.googleusercontent.com";
      oauthService = new OAuthService();
    });

    it("should verify a valid Google token", async () => {
      const idToken = "valid-google-token";
      const mockPayload = {
        sub: "google-user-123",
        email: "user@gmail.com",
        name: "Test User",
        picture: "https://example.com/photo.jpg",
        email_verified: true,
      };

      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload),
      };

      const mockClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };

      (
        OAuth2Client as jest.MockedClass<typeof OAuth2Client>
      ).mockImplementation(() => mockClient as any);

      // Create new instance to get mocked client
      const service = new OAuthService();

      const result = await service.verifyGoogleToken(idToken);

      expect(result.sub).toBe("google-user-123");
      expect(result.email).toBe("user@gmail.com");
      expect(result.name).toBe("Test User");
      expect(result.picture).toBe("https://example.com/photo.jpg");
      expect(result.email_verified).toBe(true);
    });

    it("should throw error if Google OAuth not configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const service = new OAuthService();

      await expect(service.verifyGoogleToken("token")).rejects.toThrow(
        "Google OAuth not configured"
      );
    });

    it("should throw error for invalid token", async () => {
      const mockClient = {
        verifyIdToken: jest.fn().mockRejectedValue(new Error("Invalid token")),
      };

      (
        OAuth2Client as jest.MockedClass<typeof OAuth2Client>
      ).mockImplementation(() => mockClient as any);

      const service = new OAuthService();

      await expect(service.verifyGoogleToken("invalid-token")).rejects.toThrow(
        "Invalid Google token"
      );
    });

    it("should throw error if payload is null", async () => {
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null),
      };

      const mockClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };

      (
        OAuth2Client as jest.MockedClass<typeof OAuth2Client>
      ).mockImplementation(() => mockClient as any);

      const service = new OAuthService();

      await expect(service.verifyGoogleToken("token")).rejects.toThrow(
        "Invalid Google token"
      );
    });
  });

  describe("verifyAppleToken", () => {
    beforeEach(() => {
      process.env.APPLE_CLIENT_ID = "com.example.app";
      oauthService = new OAuthService();
    });

    it("should verify a valid Apple token", async () => {
      const idToken = "valid-apple-token";
      const mockPayload = {
        sub: "apple-user-123",
        email: "user@example.com",
        email_verified: "true",
      };

      (appleSignin.verifyIdToken as jest.Mock).mockResolvedValue(mockPayload);

      const result = await oauthService.verifyAppleToken(idToken);

      expect(result.sub).toBe("apple-user-123");
      expect(result.email).toBe("user@example.com");
      expect(result.email_verified).toBe(true);
      expect(appleSignin.verifyIdToken).toHaveBeenCalledWith(idToken, {
        audience: "com.example.app",
        ignoreExpiration: false,
      });
    });

    it("should handle email_verified as false", async () => {
      const idToken = "valid-apple-token";
      const mockPayload = {
        sub: "apple-user-123",
        email: "user@example.com",
        email_verified: "false",
      };

      (appleSignin.verifyIdToken as jest.Mock).mockResolvedValue(mockPayload);

      const result = await oauthService.verifyAppleToken(idToken);

      expect(result.email_verified).toBe(false);
    });

    it("should throw error if Apple OAuth not configured", async () => {
      delete process.env.APPLE_CLIENT_ID;
      const service = new OAuthService();

      await expect(service.verifyAppleToken("token")).rejects.toThrow(
        "Apple OAuth not configured"
      );
    });

    it("should throw error for invalid token", async () => {
      (appleSignin.verifyIdToken as jest.Mock).mockRejectedValue(
        new Error("Invalid token")
      );

      await expect(
        oauthService.verifyAppleToken("invalid-token")
      ).rejects.toThrow("Invalid Apple token");
    });
  });
});
