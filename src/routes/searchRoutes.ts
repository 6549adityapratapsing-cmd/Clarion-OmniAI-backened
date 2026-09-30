import { Router } from 'express';
import { searchDocuments } from '../controllers/searchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, searchDocuments);

export default router;
