import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateDriverSchema } from '@fleetwise/shared';
import * as DriverController from './drivers.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

router.get('/', requirePermission('driver.read'), DriverController.listDrivers);
router.post('/', requirePermission('driver.create'), validate(CreateDriverSchema), DriverController.createDriver);
router.get('/:driverId', requirePermission('driver.read'), DriverController.getDriver);
router.patch('/:driverId', requirePermission('driver.update'), DriverController.updateDriver);

export default router;
