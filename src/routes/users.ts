import { Router, Request, Response } from 'express';

const router: Router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get users list (placeholder)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Users list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Users endpoint
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Users endpoint',
    users: [],
  });
});

export default router;
