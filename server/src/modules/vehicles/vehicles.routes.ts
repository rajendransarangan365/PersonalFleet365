import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateVehicleSchema, UpdateVehicleSchema } from '@fleetwise/shared';
import * as VehicleController from './vehicles.controller.js';

const router = Router({ mergeParams: true });

// Cloudinary storage usage & free tier quota gauge
router.get('/media/quota', VehicleController.getCloudinaryQuotaHandler);

router.use(requireAuth, requireBusinessMembership);
router.get('/', requirePermission('vehicle.read'), VehicleController.listVehicles);
router.post('/', requirePermission('vehicle.create'), validate(CreateVehicleSchema), VehicleController.createVehicle);
router.get('/:vehicleId', requirePermission('vehicle.read'), VehicleController.getVehicle);
router.patch('/:vehicleId', requirePermission('vehicle.update'), validate(UpdateVehicleSchema), VehicleController.updateVehicle);
router.delete('/:vehicleId', requirePermission('vehicle.delete'), VehicleController.deactivateVehicle);

// Vehicle photo proof gallery (Front, Back, Left, Right)
router.post('/:vehicleId/photos', requirePermission('vehicle.update'), VehicleController.uploadVehiclePhoto);
router.delete('/:vehicleId/photos/:angle', requirePermission('vehicle.update'), VehicleController.deleteVehiclePhoto);

export default router;
