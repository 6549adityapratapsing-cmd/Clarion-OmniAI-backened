import { Router } from 'express';
import assistantRoutes from './assistantRoutes';
import authRoutes from './authRoutes';
import demoRoutes from './demoRoutes';
import documentRoutes from './documentRoutes';
import insightRoutes from './insightRoutes';
import searchRoutes from './searchRoutes';
import supplierRoutes from './supplierRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/search', searchRoutes);
router.use('/assistant', assistantRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/insights', insightRoutes);
router.use('/dashboard', insightRoutes);
router.use('/demo', demoRoutes);

export default router;
