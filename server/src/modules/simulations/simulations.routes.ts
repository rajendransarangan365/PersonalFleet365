import { Router } from 'express';
import { requireAuth, requireBusinessMembership } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateSimulationSchema } from '@fleetwise/shared';
import * as SimController from './simulations.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

router.get('/', SimController.listSimulations);
router.post('/', validate(CreateSimulationSchema), SimController.createSimulation);
router.post('/run', SimController.runInstantSimulation);
router.get('/:simulationId', SimController.getSimulation);
router.delete('/:simulationId', SimController.deleteSimulation);

export default router;
