import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateBusinessSchema, UpdateBusinessSchema } from '@fleetwise/shared';
import * as BusinessController from './businesses.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(CreateBusinessSchema), BusinessController.createBusiness);
router.get('/', BusinessController.listMyBusinesses);
router.get('/:businessId', BusinessController.getBusiness);
router.patch('/:businessId', validate(UpdateBusinessSchema), BusinessController.updateBusiness);

export default router;
