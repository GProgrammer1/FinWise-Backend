import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export interface PasswordResetTokenPayload {
  userId: string;
  email: string;
  type: 'password-reset';
}

export class JwtService {
  private accessSecret: string;
  private refreshSecret: string;
  private accessTtl: string;
  private refreshTtl: string;

  constructor() {
    this.accessSecret = process.env.JWT_ACCESS_SECRET || 'change-this-secret';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret';
    this.accessTtl = process.env.JWT_ACCESS_TTL || '15m';
    this.refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload as any, this.accessSecret, {
      expiresIn: this.accessTtl,
      issuer: 'finwise-api',
      audience: 'finwise-app',
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token (long-lived)
   */
  generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload as any, this.refreshSecret, {
      expiresIn: this.refreshTtl,
      issuer: 'finwise-api',
      audience: 'finwise-app',
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.accessSecret, {
      issuer: 'finwise-api',
      audience: 'finwise-app',
    }) as AccessTokenPayload;
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, this.refreshSecret, {
      issuer: 'finwise-api',
      audience: 'finwise-app',
    }) as RefreshTokenPayload;
  }

  /**
   * Hash refresh token for storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Calculate expiration date based on TTL
   */
  getRefreshTokenExpiration(): Date {
    const ms = this.parseTtl(this.refreshTtl);
    return new Date(Date.now() + ms);
  }

  /**
   * Generate password reset token (short-lived, 1 hour)
   */
  generatePasswordResetToken(payload: PasswordResetTokenPayload): string {
    return jwt.sign(payload as any, this.accessSecret, {
      expiresIn: '1h',
      issuer: 'finwise-api',
      audience: 'finwise-app',
    } as jwt.SignOptions);
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
    return jwt.verify(token, this.accessSecret, {
      issuer: 'finwise-api',
      audience: 'finwise-app',
    }) as PasswordResetTokenPayload;
  }

  private parseTtl(ttl: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid TTL format: ${ttl}`);
    }

    const [, amount, unit] = match;
    return parseInt(amount, 10) * units[unit];
  }
}

export const jwtService = new JwtService();
