import { Router } from 'express';
import { getScenarios, loadScenario } from '../controllers/demoController';

const router = Router();

// Demo routes are public so any evaluator can initialize scenarios immediately
router.get('/scenarios', getScenarios);
router.post('/load/:scenarioId', loadScenario);

export default router;
