import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { jwtService } from './jwt.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const tokenId = randomUUID();

    const accessToken = jwtService.generateAccessToken({
      userId,
      email,
      role,
    });

    const refreshToken = jwtService.generateRefreshToken({
      userId,
      tokenId,
    });

    // Store refresh token hash
    const tokenHash = jwtService.hashToken(refreshToken);
    const expiresAt = jwtService.getRefreshTokenExpiration();

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh tokens (with rotation)
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify JWT
    jwtService.verifyRefreshToken(refreshToken);
    const tokenHash = jwtService.hashToken(refreshToken);

    // Check if token exists and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new Error('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new Error('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token has expired');
    }

    if (storedToken.user.deletedAt) {
      throw new Error('User account has been deleted');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new token pair
    return this.generateTokenPair(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role
    );
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = jwtService.hashToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null, lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Revoked > 30 days ago
        ],
      },
    });

    return result.count;
  }
}

export const tokenService = new TokenService();
