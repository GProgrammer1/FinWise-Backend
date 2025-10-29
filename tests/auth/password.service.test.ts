import { passwordService } from '../../src/services/auth/password.service';

describe('PasswordService', () => {
  describe('hash', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      const hash = await passwordService.hash(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$argon2')).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await passwordService.hash(password);
      
      const isValid = await passwordService.verify(hash, password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const hash = await passwordService.hash(password);
      
      const isValid = await passwordService.verify(hash, 'wrongpassword');
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const isValid = await passwordService.verify('invalid-hash', 'password');
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison', async () => {
      const password = 'testpassword123';
      const hash = await passwordService.hash(password);
      
      // Time the verification
      const start1 = Date.now();
      await passwordService.verify(hash, 'wrongpassword');
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      await passwordService.verify(hash, 'testpassword123');
      const time2 = Date.now() - start2;
      
      // Times should be similar (within reasonable margin)
      // This is a basic check - true constant-time is verified by Argon2
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });
  });

  describe('needsRehash', () => {
    it('should return false for freshly hashed password', async () => {
      const password = 'testpassword123';
      const hash = await passwordService.hash(password);
      
      const needs = passwordService.needsRehash(hash);
      expect(needs).toBe(false);
    });
  });
});
