import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadSingle } from '../utils/multer';
import rateLimit from 'express-rate-limit';

const router = Router();

// Strict rate limiting for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  message: 'Too many signup attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /auth/signup
 * Register new user (multipart/form-data)
 * Body: role, name, email, password, [parent fields], [idImage file]
 */
router.post('/signup', signupRateLimiter, uploadSingle('idImage'), (req, res) =>
  authController.signup(req, res)
);

/**
 * POST /auth/login
 * Authenticate user
 * Body: { email, password }
 */
router.post('/login', authRateLimiter, (req, res) =>
  authController.login(req, res)
);

/**
 * POST /auth/oauth
 * OAuth authentication (Google/Apple)
 * Body: { provider, idToken }
 */
router.post('/oauth', authRateLimiter, (req, res) =>
  authController.oauth(req, res)
);

/**
 * POST /auth/refresh
 * Refresh access token
 * Body: { refreshToken }
 */
router.post('/refresh', (req, res) =>
  authController.refresh(req, res)
);

/**
 * POST /auth/logout
 * Revoke refresh token
 * Body: { refreshToken }
 */
router.post('/logout', (req, res) =>
  authController.logout(req, res)
);

/**
 * GET /auth/me
 * Get current user profile
 * Requires: Authorization header with Bearer token
 */
router.get('/me', requireAuth, (req, res) =>
  authController.me(req, res)
);

export default router;
