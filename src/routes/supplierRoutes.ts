import { Router } from 'express';
import { getSupplierById, listSuppliers } from '../controllers/supplierController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken as any, listSuppliers);
router.get('/:id', authenticateToken as any, getSupplierById);

export default router;
