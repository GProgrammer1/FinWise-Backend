import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Users endpoint',
    users: [],
  });
});

export default router;
