import React, { useState, useEffect } from 'react';
import {
  X, Camera, Upload, Trash2, Cloud, CheckCircle2,
  AlertTriangle, RefreshCw, ShieldCheck, Image as ImageIcon
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../services/api.js';

interface VehiclePhoto {
  url: string;
  publicId: string;
  uploadedAt: string;
}

export interface VehiclePhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  vehicleRegistration?: string;
  registrationNumber?: string;
  photos?: {
    front?: VehiclePhoto;
    back?: VehiclePhoto;
    left?: VehiclePhoto;
    right?: VehiclePhoto;
  };
  initialPhotos?: {
    front?: { url: string };
    back?: { url: string };
    left?: { url: string };
    right?: { url: string };
  };
  onPhotosUpdated?: () => void;
  canEdit?: boolean;
  userRole?: string;
}

interface CloudinaryQuota {
  plan: string;
  usedFormatted: string;
  limitFormatted: string;
  usagePercent: number;
  creditsUsed: number;
  creditsLimit: number;
  remainingCredits: number;
  totalObjects: number;
  isFreeTierSafe: boolean;
}

const ANGLES: Array<{ key: 'front' | 'back' | 'left' | 'right'; label: string; tip: string }> = [
  { key: 'front', label: '1. Front View', tip: 'Number plate, bumper & windshield' },
  { key: 'back', label: '2. Rear View', tip: 'Boot, rear bumper & tail lights' },
  { key: 'left', label: '3. Left Side', tip: 'Driver/passenger side panels & tyres' },
  { key: 'right', label: '4. Right Side', tip: 'Opposite side panels, doors & tyres' },
];

export default function VehiclePhotoGalleryModal({
  isOpen,
  onClose,
  vehicleId,
  vehicleRegistration,
  registrationNumber,
  photos,
  initialPhotos,
  onPhotosUpdated,
  canEdit = true,
  userRole = 'owner',
}: VehiclePhotoGalleryModalProps) {
  const displayReg = registrationNumber || vehicleRegistration || 'Vehicle';
  const isEditable = userRole === 'driver' ? false : canEdit;
  const [quota, setQuota] = useState<CloudinaryQuota | null>(null);
  const [loadingAngle, setLoadingAngle] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchQuota = async () => {
    try {
      const res = await apiGet<any>(`/vehicles/media/quota`);
      if (res && res.data) setQuota(res.data);
      else if (res) setQuota(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuota();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (angle: 'front' | 'back' | 'left' | 'right', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG/JPG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size must be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setLoadingAngle(angle);
      setErrorMsg(null);
      try {
        await apiPost(`/vehicles/${vehicleId}/photos`, {
          angle,
          imageBase64: base64Data,
        });
        setSuccessMsg(`Uploaded ${angle} photo! Replaced old asset on Cloudinary to save free tier space.`);
        await fetchQuota();
        onPhotosUpdated();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to upload photo to Cloudinary');
      } finally {
        setLoadingAngle(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (angle: 'front' | 'back' | 'left' | 'right') => {
    if (!confirm(`Are you sure you want to delete the ${angle} photo? This will free space on Cloudinary.`)) return;

    setLoadingAngle(angle);
    try {
      await apiDelete(`/vehicles/${vehicleId}/photos/${angle}`);
      setSuccessMsg(`Deleted ${angle} photo and freed Cloudinary storage.`);
      await fetchQuota();
      onPhotosUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete photo');
    } finally {
      setLoadingAngle(null);
    }
  };

  const existingCount = ['front', 'back', 'left', 'right'].filter(
    (k) => !!photos?.[k as keyof typeof photos]?.url
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Vehicle Condition Proof Gallery
                <span className="badge badge-info text-xs font-mono">{vehicleRegistration}</span>
              </h2>
              <p className="text-xs text-slate-400">
                4-Angle handoff inspection proof stored in Cloudinary free tier ({existingCount}/4 captured)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloudinary Quota Tracker Banner */}
        <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-slate-300 font-medium">Cloudinary Free Tier Storage: </span>
              <span className="text-white font-mono font-bold">{quota ? quota.usedFormatted : 'Checking...'}</span>
              <span className="text-slate-500"> / {quota ? quota.limitFormatted : '25 GB'}</span>
            </div>
            {quota && (
              <span className={`badge ${quota.isFreeTierSafe ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                {quota.remainingCredits} Credits Left
              </span>
            )}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Auto-Deletes Old Photos on Replace
          </span>
        </div>

        {/* Feedback messages */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 4 Photo Slots Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ANGLES.map(({ key, label, tip }) => {
            const photo = photos?.[key];
            const isLoading = loadingAngle === key;

            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-700/80 bg-slate-800/40 p-4 flex flex-col justify-between overflow-hidden relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{label}</h4>
                    <p className="text-[11px] text-slate-400">{tip}</p>
                  </div>
                  {photo?.url ? (
                    <span className="badge badge-success text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Captured
                    </span>
                  ) : (
                    <span className="badge badge-warning text-[10px]">Pending</span>
                  )}
                </div>

                {/* Image Preview or Placeholder */}
                <div className="w-full h-44 rounded-xl bg-slate-900 border border-slate-700/60 overflow-hidden flex items-center justify-center relative my-2">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-brand-400">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-medium">Optimizing & Uploading...</span>
                    </div>
                  ) : photo?.url ? (
                    <img
                      src={photo.url}
                      alt={label}
                      className="w-full h-full object-cover rounded-xl hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-xs">No image uploaded</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/60">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                    {photo?.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString() : 'Max 1 file'}
                  </span>

                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {photo?.url && (
                        <button
                          onClick={() => handleDelete(key)}
                          disabled={isLoading}
                          className="btn-danger p-1.5 text-xs rounded-lg flex items-center gap-1"
                          title="Delete from Cloudinary to free storage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <label className="btn-secondary py-1.5 px-3 text-xs rounded-lg cursor-pointer flex items-center gap-1.5 hover:border-brand-500">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{photo?.url ? 'Replace' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(key, e)}
                          disabled={isLoading}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>🔒 Only Manager and Owner have permission to update vehicle condition proof.</span>
          <button onClick={onClose} className="btn-primary py-1.5 px-4 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
