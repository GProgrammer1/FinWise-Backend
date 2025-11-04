import hpp from 'hpp';
import { Application } from 'express';

/**
 * Configure security middleware for the Express application
 */
export const setupSecurity = (app: Application): void => {
  

  // Protect against HTTP Parameter Pollution attacks
  app.use(hpp());

  // Disable X-Powered-By header
  app.disable('x-powered-by');
};
