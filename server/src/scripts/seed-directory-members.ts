import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { UserModel, BusinessModel, BusinessMembershipModel, DriverDutyModel } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';

async function seedDirectoryMembers() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  // 1. Ensure Owner
  const ownerHash = await hashPassword('FleetPass@2026');
  let owner = await UserModel.findOne({ email: 'sarangan365@gmail.com' });
  if (owner) {
    owner.displayName = 'Sarangan (Company Owner)';
    owner.role = 'fleet_owner';
    owner.phone = '+91 9629991655';
    owner.passwordHash = ownerHash;
    owner.isActive = true;
    owner.emailVerified = true;
    await owner.save();
  } else {
    owner = await UserModel.create({
      email: 'sarangan365@gmail.com',
      passwordHash: ownerHash,
      displayName: 'Sarangan (Company Owner)',
      phone: '+91 9629991655',
      role: 'fleet_owner',
      isActive: true,
      emailVerified: true,
    });
  }
  console.log('Verified Owner:', owner.email);

  // 2. Ensure Business
  let business = await BusinessModel.findOne();
  if (!business) {
    business = await BusinessModel.create({
      name: 'Fleet 365 Operations',
      ownerId: owner._id,
      currency: 'INR',
      region: 'TN',
      country: 'IN',
      subscriptionTier: 'enterprise',
      isActive: true,
    });
  } else {
    business.ownerId = owner._id;
    await business.save();
  }

  // Ensure Owner Membership
  await BusinessMembershipModel.findOneAndUpdate(
    { businessId: business._id, userId: owner._id },
    {
      businessId: business._id,
      userId: owner._id,
      role: 'fleet_owner',
      permissions: ['*'],
      isActive: true,
    },
    { upsert: true }
  );

  // 3. Ensure Staff Members created in directory with Password@123
  const staffMembers = [
    {
      name: 'Prasana',
      email: 'prasana365@gmail.com',
      phone: '+91 98402 11223',
      role: 'telecaller',
      password: 'Password@123',
    },
    {
      name: 'Madhan',
      email: 'madhan365@gmail.com',
      phone: '+91 99949 49576',
      role: 'fleet_manager',
      password: 'Password@123',
    },
    {
      name: 'Bala',
      email: 'bala365@gmail.com',
      phone: '+91 98401 23456',
      role: 'driver',
      vehiclePlate: 'TN01BV4589',
      vehicleModel: 'Maruti Suzuki Tour S (CNG)',
      password: 'Password@123',
    },
  ];

  const defaultStaffHash = await hashPassword('Password@123');

  for (const staff of staffMembers) {
    const normalizedEmail = staff.email.toLowerCase().trim();
    let u = await UserModel.findOne({
      $or: [{ email: normalizedEmail }, { email: staff.email }]
    });

    if (u) {
      u.displayName = staff.name;
      u.email = normalizedEmail;
      u.role = staff.role;
      u.phone = staff.phone;
      u.passwordHash = defaultStaffHash;
      u.isActive = true;
      u.emailVerified = true;
      await u.save();
      console.log('Updated user in DB:', u.email, `(${u.role})`);
    } else {
      u = await UserModel.create({
        email: normalizedEmail,
        passwordHash: defaultStaffHash,
        displayName: staff.name,
        phone: staff.phone,
        role: staff.role,
        isActive: true,
        emailVerified: true,
      });
      console.log('Created user in DB:', u.email, `(${u.role})`);
    }

    // Attach membership
    await BusinessMembershipModel.findOneAndUpdate(
      { businessId: business._id, userId: u._id },
      {
        businessId: business._id,
        userId: u._id,
        role: staff.role,
        permissions: staff.role === 'fleet_manager' ? ['fleet:*', 'trips:*'] : ['driver:console'],
        isActive: true,
      },
      { upsert: true }
    );

    // If driver, initialize duty
    if (staff.role === 'driver') {
      await DriverDutyModel.findOneAndUpdate(
        { driverId: String(u._id) },
        {
          driverId: String(u._id),
          driverName: staff.name,
          driverPhone: staff.phone,
          status: 'online',
          vehiclePlate: staff.vehiclePlate,
          vehicleModel: staff.vehicleModel,
          lastStatusChange: new Date(),
        },
        { upsert: true }
      );
    }
  }

  console.log('All staff members synchronized successfully with MongoDB Atlas.');
  await mongoose.disconnect();
}

seedDirectoryMembers().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
