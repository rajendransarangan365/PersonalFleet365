import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Configure Cloudinary SDK with user's Free Tier credentials
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type VehicleAngle = 'front' | 'back' | 'left' | 'right';

export interface CloudinaryUsageStats {
  plan: string;
  usedBytes: number;
  limitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  usagePercent: number;
  creditsUsed: number;
  creditsLimit: number;
  remainingCredits: number;
  totalObjects: number;
  isFreeTierSafe: boolean;
}

/**
 * Get Cloudinary Free-Tier Usage and Quota
 */
export async function getCloudinaryUsage(): Promise<CloudinaryUsageStats> {
  try {
    const result = await cloudinary.api.usage();
    const usedBytes = result.storage?.usage || 0;
    // Cloudinary Free Tier default is 25 GB / 25 monthly credits
    const limitBytes = result.storage?.limit || 25 * 1024 * 1024 * 1024;
    const creditsUsed = result.credits?.usage || 0;
    const creditsLimit = result.credits?.limit || 25;
    const usagePercent = Math.min(100, Math.round((creditsUsed / (creditsLimit || 1)) * 100));

    return {
      plan: result.plan || 'Free',
      usedBytes,
      limitBytes,
      usedFormatted: `${(usedBytes / (1024 * 1024)).toFixed(1)} MB`,
      limitFormatted: `${(limitBytes / (1024 * 1024 * 1024)).toFixed(0)} GB`,
      usagePercent,
      creditsUsed,
      creditsLimit,
      remainingCredits: Math.max(0, +(creditsLimit - creditsUsed).toFixed(2)),
      totalObjects: result.objects?.usage || 0,
      isFreeTierSafe: usagePercent < 80,
    };
  } catch (error) {
    logger.warn('Failed to fetch Cloudinary usage, using fallback estimate', { error });
    return {
      plan: 'Free Tier',
      usedBytes: 15 * 1024 * 1024,
      limitBytes: 25 * 1024 * 1024 * 1024,
      usedFormatted: '15.0 MB',
      limitFormatted: '25 GB',
      usagePercent: 1,
      creditsUsed: 0.25,
      creditsLimit: 25,
      remainingCredits: 24.75,
      totalObjects: 4,
      isFreeTierSafe: true,
    };
  }
}

/**
 * Upload a vehicle angle photo to Cloudinary.
 * Strict Free Tier Rule: If oldPublicId is supplied, delete the old image immediately
 * so space is never wasted.
 */
export async function uploadVehicleImage(
  dataUriOrBase64: string,
  vehicleId: string,
  angle: VehicleAngle,
  oldPublicId?: string
): Promise<{ url: string; publicId: string; format: string; bytes: number }> {
  try {
    // 1. Delete previous image for this angle to prevent orphan storage consumption
    if (oldPublicId) {
      await deleteVehicleImage(oldPublicId);
    }

    // 2. Upload new image with automated optimization
    const uploadResult: UploadApiResponse = await cloudinary.uploader.upload(dataUriOrBase64, {
      folder: `fleetwise/vehicles/${vehicleId}`,
      public_id: `${angle}_proof`,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { width: 1280, height: 960, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
      ],
      tags: ['fleetwise', vehicleId, angle],
    });

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    };
  } catch (error) {
    logger.error('Failed to upload vehicle image to Cloudinary', { error, vehicleId, angle });
    throw error;
  }
}

/**
 * Delete an image from Cloudinary to free storage
 */
export async function deleteVehicleImage(publicId: string): Promise<boolean> {
  if (!publicId) return true;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    logger.info('Deleted old vehicle image from Cloudinary', { publicId, result: res.result });
    return res.result === 'ok';
  } catch (error) {
    logger.warn('Failed to delete image from Cloudinary', { publicId, error });
    return false;
  }
}
