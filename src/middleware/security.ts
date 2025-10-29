import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import { Application } from 'express';

/**
 * Configure security middleware for the Express application
 * Includes protection against common web vulnerabilities
 */
export const setupSecurity = (app: Application): void => {
  // Helmet helps secure Express apps by setting various HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200,
  }));

  // Protect against HTTP Parameter Pollution attacks
  app.use(hpp());

  // Disable X-Powered-By header
  app.disable('x-powered-by');
};
