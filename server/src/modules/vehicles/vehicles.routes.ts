import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateVehicleSchema, UpdateVehicleSchema } from '@fleetwise/shared';
import * as VehicleController from './vehicles.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

router.get('/', requirePermission('vehicle.read'), VehicleController.listVehicles);
router.post('/', requirePermission('vehicle.create'), validate(CreateVehicleSchema), VehicleController.createVehicle);
router.get('/:vehicleId', requirePermission('vehicle.read'), VehicleController.getVehicle);
router.patch('/:vehicleId', requirePermission('vehicle.update'), validate(UpdateVehicleSchema), VehicleController.updateVehicle);
router.delete('/:vehicleId', requirePermission('vehicle.delete'), VehicleController.deactivateVehicle);

export default router;
