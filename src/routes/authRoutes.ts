import { Router } from 'express';
import { getMe, login, logout, register } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateToken as any, getMe as any);

export default router;
