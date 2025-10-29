import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

export interface GoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
}

export interface AppleTokenPayload {
  sub: string; // Apple user ID
  email?: string;
  email_verified?: boolean;
}

export class OAuthService {
  private googleClient: OAuth2Client | null = null;

  constructor() {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  /**
   * Verify Google ID token
   */
  async verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!this.googleClient) {
      throw new Error('Google OAuth not configured');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid token payload');
      }

      return {
        sub: payload.sub,
        email: payload.email || '',
        name: payload.name,
        picture: payload.picture,
        email_verified: payload.email_verified || false,
      };
    } catch (error) {
      throw new Error('Invalid Google token');
    }
  }

  /**
   * Verify Apple ID token
   */
  async verifyAppleToken(idToken: string): Promise<AppleTokenPayload> {
    const appleClientId = process.env.APPLE_CLIENT_ID;
    if (!appleClientId) {
      throw new Error('Apple OAuth not configured');
    }

    try {
      const payload = await appleSignin.verifyIdToken(idToken, {
        audience: appleClientId,
        ignoreExpiration: false,
      });

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified === 'true',
      };
    } catch (error) {
      throw new Error('Invalid Apple token');
    }
  }
}

export const oauthService = new OAuthService();
