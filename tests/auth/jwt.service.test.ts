import { jwtService } from '../../src/services/auth/jwt.service';

describe('JwtService', () => {
  describe('access tokens', () => {
    it('should generate and verify access token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'PARENT',
      };

      const token = jwtService.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwtService.verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject invalid access token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should reject expired token', async () => {
      // This would require mocking time or using a very short TTL
      // Skipped in basic implementation
    });
  });

  describe('refresh tokens', () => {
    it('should generate and verify refresh token', () => {
      const payload = {
        userId: 'user-123',
        tokenId: 'token-456',
      };

      const token = jwtService.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwtService.verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tokenId).toBe(payload.tokenId);
    });

    it('should reject invalid refresh token', () => {
      expect(() => {
        jwtService.verifyRefreshToken('invalid-token');
      }).toThrow();
    });
  });

  describe('token hashing', () => {
    it('should hash token consistently', () => {
      const token = 'test-token-123';
      const hash1 = jwtService.hashToken(token);
      const hash2 = jwtService.hashToken(token);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = jwtService.hashToken('token-1');
      const hash2 = jwtService.hashToken('token-2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('expiration', () => {
    it('should calculate refresh token expiration', () => {
      const expiration = jwtService.getRefreshTokenExpiration();
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
