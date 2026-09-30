import { Router } from 'express';
import { getDashboardMetrics, listInsights } from '../controllers/insightController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, listInsights);
router.get('/metrics', authenticateToken as any, getDashboardMetrics);

export default router;
