import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/auth/jwt.service';
import { errors } from '../utils/response';
import prisma from '../config/database';

/**
 * Middleware to require authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errors.unauthorized(res, 'Missing or invalid authorization header');
      return;
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyAccessToken(token);

    // Verify user still exists and is not deleted
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      errors.unauthorized(res, 'User not found or deleted');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      errors.unauthorized(res, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      errors.unauthorized(res, 'Token expired');
    } else {
      errors.unauthorized(res, 'Authentication failed');
    }
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errors.unauthorized(res, 'Authentication required');
      return;
    }

    if (!roles.includes(req.user.role)) {
      errors.forbidden(res, `Requires one of: ${roles.join(', ')}`);
      return;
    }

    next();
  };
}

/**
 * Optional authentication (sets user if valid token provided)
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtService.verifyAccessToken(token);

      const user = await prisma.user.findFirst({
        where: {
          id: payload.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }

  next();
}
