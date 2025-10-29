import express, { Application, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import path from 'path';
import logger from 'morgan';
import dotenv from 'dotenv';

// Middleware
import { setupSecurity } from './middleware/security';
import { globalRateLimiter } from './middleware/rateLimiter';

// Routes
import indexRouter from './routes/index';
import usersRouter from './routes/users';

// Load environment variables
dotenv.config();

const app: Application = express();

// Security middleware (helmet, cors, hpp)
setupSecurity(app);

// Global rate limiting
app.use(globalRateLimiter);

// Logging
app.use(logger('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Catch 404 and forward to error handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createError(404));
});

// Error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Send JSON error response
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      ...(req.app.get('env') === 'development' && { stack: err.stack }),
    },
  });
});

export default app;
