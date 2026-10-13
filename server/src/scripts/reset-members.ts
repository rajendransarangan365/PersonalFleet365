import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { UserModel, BusinessModel, BusinessMembershipModel, DriverDutyModel } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';

async function resetMembers() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const passwordHash = await hashPassword('FleetPass@2026');

  // 1. Upsert Company Owner
  let owner = await UserModel.findOne({ email: 'sarangan365@gmail.com' });
  if (owner) {
    owner.displayName = 'Sarangan (Company Owner)';
    owner.role = 'fleet_owner';
    owner.phone = '+91 9629991655';
    owner.passwordHash = passwordHash;
    owner.isActive = true;
    owner.emailVerified = true;
    await owner.save();
    console.log('Updated existing owner account:', owner.email);
  } else {
    owner = await UserModel.create({
      email: 'sarangan365@gmail.com',
      passwordHash,
      displayName: 'Sarangan (Company Owner)',
      phone: '+91 9629991655',
      role: 'fleet_owner',
      isActive: true,
      emailVerified: true,
    });
    console.log('Created owner account:', owner.email);
  }

  // 2. Remove all non-owner mock staff users
  const deleteResult = await UserModel.deleteMany({
    email: { $ne: 'sarangan365@gmail.com' },
  });
  console.log('Deleted non-owner mock users count:', deleteResult.deletedCount);

  // 3. Clear DriverDutyModel mock drivers
  const driverDelete = await DriverDutyModel.deleteMany({});
  console.log('Cleared DriverDutyModel entries:', driverDelete.deletedCount);

  // 4. Ensure Business exists and owned by Sarangan
  let business = await BusinessModel.findOne();
  if (business) {
    business.ownerId = owner._id;
    await business.save();
    console.log('Updated business owner to Sarangan:', business.name);
  } else {
    business = await BusinessModel.create({
      name: 'Fleet 365 Operations',
      ownerId: owner._id,
      currency: 'INR',
      region: 'TN',
      country: 'IN',
      subscriptionTier: 'enterprise',
      isActive: true,
    });
    console.log('Created primary business:', business.name);
  }

  // 5. Ensure BusinessMembership for Company Owner
  await BusinessMembershipModel.deleteMany({ userId: { $ne: owner._id } });
  await BusinessMembershipModel.findOneAndUpdate(
    { businessId: business._id, userId: owner._id },
    {
      businessId: business._id,
      userId: owner._id,
      role: 'fleet_owner',
      permissions: ['*'],
      isActive: true,
    },
    { upsert: true, new: true },
  );
  console.log('Configured business membership for Company Owner');

  await mongoose.disconnect();
  console.log('All mock staff removed. Company owner Sarangan is configured as primary fleet_owner with password FleetPass@2026.');
}

resetMembers().catch((err) => {
  console.error('Reset error:', err);
  process.exit(1);
});
