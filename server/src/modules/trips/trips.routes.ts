import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateTripSchema } from '@fleetwise/shared';
import * as TripController from './trips.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

router.get('/', requirePermission('trip.read'), TripController.listTrips);
router.post('/', requirePermission('trip.create'), validate(CreateTripSchema), TripController.createTrip);
router.get('/:tripId', requirePermission('trip.read'), TripController.getTrip);
router.patch('/:tripId/cancel', requirePermission('trip.cancel'), TripController.cancelTrip);

export default router;
