import argon2 from 'argon2';

export class PasswordService {
  /**
   * Hash a password using Argon2
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify password using constant-time comparison
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      // Invalid hash format
      return false;
    }
  }

  /**
   * Check if hash needs rehashing (e.g., after parameter changes)
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }
}

export const passwordService = new PasswordService();
