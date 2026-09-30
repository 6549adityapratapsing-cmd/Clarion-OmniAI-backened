import { Router } from 'express';
import { queryAssistant } from '../controllers/assistantController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/query', authenticateToken as any, queryAssistant);

export default router;
