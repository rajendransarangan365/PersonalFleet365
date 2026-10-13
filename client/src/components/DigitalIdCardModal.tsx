import React, { useState } from 'react';
import {
  X, Shield, Award, CheckCircle2, Car, Phone, Mail,
  Calendar, QrCode, Download, Share2, Sparkles, Building2,
  KeyRound, CreditCard, ExternalLink, Printer, User, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import { useContactsStore, type FleetContact } from '../store/contacts.store.js';

interface DigitalIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'driver' | 'manager' | 'owner' | 'telecaller';
  contactId?: string;
}

export interface IdCardData {
  name: string;
  role: 'owner' | 'manager' | 'driver' | 'telecaller';
  roleTitle: string;
  staffId: string;
  phone: string;
  email: string;
  avatarColor: string;
  department: string;
  joinedDate: string;
  bloodGroup: string;
  emergencyContact: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  drivingLicence?: {
    dlNumber: string;
    dlClass: string;
    issuingRto: string;
    issueDate: string;
    validUntil: string;
    badgeNumber: string;
    badgeValidUntil: string;
    parivahanVerified: boolean;
  };
  corporateDetails?: {
    cinNumber?: string;
    gstin?: string;
    executiveAccess?: string;
  };
  telecallerDetails?: {
    agentCode?: string;
    supportShift?: string;
    deskExtension?: string;
  };
}

export const OFFICIAL_ID_CARDS: Record<string, IdCardData> = {
  driver: {
    name: 'Bala',
    role: 'driver',
    roleTitle: 'Commercial Duty Driver & Fleet Captain',
    staffId: 'FLEET365-DRV-4589',
    phone: '+91 98401 23456',
    email: 'bala365@gmail.com',
    avatarColor: 'from-emerald-500 via-teal-600 to-emerald-700',
    department: 'Passenger Operations & Commercial Duty',
    joinedDate: '10-MAR-2024',
    bloodGroup: 'O+',
    emergencyContact: '+91 9629991655 (Fleet Command)',
    vehiclePlate: 'TN01BV4589',
    vehicleModel: 'Maruti Suzuki Tour S (CNG)',
    drivingLicence: {
      dlNumber: 'TN01 20180045892',
      dlClass: 'LMV-TRANSPORT / COMMERCIAL CAB',
      issuingRto: 'TN-01 Chennai Central (Ayanavaram RTO)',
      issueDate: '12-MAR-2018',
      validUntil: '28-NOV-2029',
      badgeNumber: 'TN/BDG/2018/04589',
      badgeValidUntil: '28-NOV-2029',
      parivahanVerified: true,
    },
  },
  manager: {
    name: 'Madhan',
    role: 'manager',
    roleTitle: 'Operations & Dispatch Manager',
    staffId: 'FLEET365-MGR-365',
    phone: '+91 99949 49576',
    email: 'madhan365@gmail.com',
    avatarColor: 'from-indigo-500 via-purple-600 to-indigo-700',
    department: 'Fleet Telematics & Route Dispatch Operations',
    joinedDate: '15-FEB-2024',
    bloodGroup: 'A+',
    emergencyContact: '+91 9629991655 (Company Owner)',
    corporateDetails: {
      executiveAccess: 'Level 4: Fleet Dispatch, Staff & Vehicle Control',
    },
  },
  owner: {
    name: 'Sarangan',
    role: 'owner',
    roleTitle: 'Founder & Managing Director (Company Owner)',
    staffId: 'FLEET365-OWN-001',
    phone: '+91 9629991655',
    email: 'sarangan365@gmail.com',
    avatarColor: 'from-amber-500 via-brand-600 to-yellow-600',
    department: 'Executive Board & Chief Command',
    joinedDate: '01-JAN-2024',
    bloodGroup: 'B+',
    emergencyContact: '+91 9629991655',
    corporateDetails: {
      cinNumber: 'U63040TN2024PTC168924',
      gstin: '33AAACF3650M1Z8',
      executiveAccess: 'Level 5: Master Authority (Full 12 Modules OS)',
    },
  },
  telecaller: {
    name: 'Prasana',
    role: 'telecaller',
    roleTitle: '24x7 Customer Helpline & Dispatch Agent',
    staffId: 'FLEET365-TEL-101',
    phone: '+91 98402 11223',
    email: 'prasana365@gmail.com',
    avatarColor: 'from-cyan-500 via-blue-600 to-cyan-700',
    department: 'Customer Grievance & Real-time Support Desk',
    joinedDate: '01-APR-2024',
    bloodGroup: 'AB+',
    emergencyContact: '+91 9629991655 (Fleet Command)',
    telecallerDetails: {
      agentCode: 'AGT-TN-402',
      deskExtension: 'Ext: #402',
      supportShift: '24x7 Emergency Help Desk Lead',
    },
  },
};

export default function DigitalIdCardModal({
  isOpen,
  onClose,
  initialRole,
  contactId,
}: DigitalIdCardModalProps) {
  const { user } = useAuthStore();
  const { contacts } = useContactsStore();

  const currentRole = (user as any)?.role || 'fleet_owner';
  const roleToShow: 'driver' | 'manager' | 'owner' | 'telecaller' = initialRole || (
    currentRole === 'driver'
      ? 'driver'
      : currentRole === 'fleet_manager' || currentRole === 'manager'
      ? 'manager'
      : currentRole === 'telecaller' || currentRole === 'support'
      ? 'telecaller'
      : 'owner'
  );

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const card = OFFICIAL_ID_CARDS[roleToShow] || OFFICIAL_ID_CARDS.driver;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${card.name} - Fleet 365 Official Digital ID`,
        text: `Official Fleet 365 ID Card for ${card.name} (${card.roleTitle}). Staff ID: ${card.staffId}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`Fleet 365 Digital ID: ${card.name} (${card.roleTitle}) | ID: ${card.staffId} | Mobile: ${card.phone}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 my-6 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Official Fleet 365 Smart ID Card</h2>
                <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Government RTO Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">Digital smart badge & Parivahan Driving Licence credential</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {/* Card Side Toggle: Front / Back */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setActiveSide('front')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeSide === 'front'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Front Smart Badge
          </button>
          <button
            onClick={() => setActiveSide('back')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeSide === 'back'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Back Card {roleToShow === 'driver' ? '(Driving Licence Details)' : '(Official Terms)'}
          </button>
        </div>

        {/* ─── THE PHYSICAL SMART ID CARD CONTAINER ─── */}
        <div className="relative mx-auto w-full max-w-md select-none transition-transform">
          {activeSide === 'front' ? (
            /* FRONT CARD */
            <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 space-y-5">
              {/* Top Watermark & Holographic Insignia Ribbon */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-white text-xs shadow-md">
                    365
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-wider uppercase text-white block">FLEET 365 OPERATIONS</span>
                    <span className="text-[9px] text-brand-400 font-mono tracking-widest uppercase">COMMERCIAL TRANSPORT CORPS</span>
                  </div>
                </div>

                {/* Holographic Chip Icon */}
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400/20 to-yellow-500/20 border border-amber-400/40 rounded-lg px-2 py-1">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[7px] font-bold text-black">
                    EMV
                  </div>
                  <span className="text-[9px] font-mono font-bold text-amber-300">RFID CHIP</span>
                </div>
              </div>

              {/* Main Profile Info & Photo */}
              <div className="flex items-start gap-4">
                {/* Photo / Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-24 h-28 rounded-2xl bg-gradient-to-br ${card.avatarColor} p-1 shadow-xl flex items-center justify-center text-white text-3xl font-extrabold relative overflow-hidden`}>
                    <span className="relative z-10 drop-shadow-md">{card.name[0]}</span>
                    {/* Security Watermark Texture */}
                    <div className="absolute inset-0 bg-white/10 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]" />
                  </div>
                  {/* Verified Shield Ribbon */}
                  <div className="absolute -bottom-2 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-lg border-2 border-slate-950">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Info Text */}
                <div className="flex-1 space-y-1.5">
                  <div>
                    <h3 className="text-lg font-black text-white tracking-wide">{card.name}</h3>
                    <p className="text-xs font-bold text-brand-300">{card.roleTitle}</p>
                    <p className="text-[10px] text-slate-400">{card.department}</p>
                  </div>

                  <div className="pt-1 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase">Staff ID:</span>
                      <span className="font-mono font-extrabold text-white text-xs">{card.staffId}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase">Blood Group:</span>
                      <span className="font-bold text-rose-400">{card.bloodGroup}</span>
                    </div>

                    {card.vehiclePlate && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase">Assigned Car:</span>
                        <span className="font-mono font-black text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          {card.vehiclePlate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Driver Driving Licence Quick Summary on Front */}
              {card.role === 'driver' && card.drivingLicence && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-emerald-300 font-bold uppercase flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      RTO Parivahan Licence No:
                    </span>
                    <span className="font-mono font-black text-white text-xs">{card.drivingLicence.dlNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Class: <b>{card.drivingLicence.dlClass}</b></span>
                    <span>Valid: <b>{card.drivingLicence.validUntil}</b></span>
                  </div>
                </div>
              )}

              {/* Owner Corporate Summary */}
              {card.role === 'owner' && card.corporateDetails && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-amber-300 font-bold uppercase">CIN / REG No:</span>
                    <span className="font-mono font-black text-white text-xs">{card.corporateDetails.cinNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-amber-300 font-bold uppercase">GSTIN:</span>
                    <span className="font-mono font-bold text-amber-200 text-xs">{card.corporateDetails.gstin}</span>
                  </div>
                </div>
              )}

              {/* Bottom Card Footer: Barcode & Security Stamp */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <div className="space-y-0.5">
                  <span className="text-slate-400 block font-mono">ISSUED: {card.joinedDate}</span>
                  <span className="text-slate-500 block font-mono">EMERGENCY: {card.emergencyContact}</span>
                </div>

                {/* Simulated QR Code */}
                <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center shadow-md">
                  <QrCode className="w-10 h-10 text-slate-950" />
                </div>
              </div>
            </div>
          ) : (
            /* BACK CARD: FULL DRIVING LICENCE & LEGAL CREDENTIALS */
            <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black tracking-wide text-white uppercase">
                    {card.role === 'driver' ? 'MOTOR VEHICLES ACT 1988 (INDIA)' : 'TERMS OF SERVICE CREDENTIAL'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  AUTHENTICATED
                </span>
              </div>

              {card.role === 'driver' && card.drivingLicence ? (
                /* DETAILED DRIVER LICENCE BACK DETAILS */
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Driving Licence No</span>
                      <span className="font-mono font-black text-emerald-400">{card.drivingLicence.dlNumber}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Vehicle Category / Class</span>
                      <span className="font-bold text-white">{card.drivingLicence.dlClass}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Issuing RTO Authority</span>
                      <span className="font-medium text-slate-300">{card.drivingLicence.issuingRto}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Issue Date</span>
                      <span className="font-mono text-slate-300">{card.drivingLicence.issueDate}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">DL Validity Expiration</span>
                      <span className="font-mono font-extrabold text-amber-400">{card.drivingLicence.validUntil}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Commercial Badge No</span>
                      <span className="font-mono font-bold text-cyan-400">{card.drivingLicence.badgeNumber}</span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Assigned Vehicle Plate</span>
                      <span className="font-mono font-bold text-white">{card.vehiclePlate} ({card.vehicleModel})</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-300/90 leading-relaxed">
                    <b>Parivahan Legal Notice:</b> The holder is legally verified under the Central Motor Vehicles Rules (CMVR) 1989 to pilot commercial transport cabs under Fleet 365 Operations. In case of verification, scan the QR code to authenticate live RTO credentials.
                  </div>
                </div>
              ) : (
                /* CORPORATE / STAFF DETAILS BACK */
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Corporate Email</span>
                      <span className="font-mono text-white">{card.email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Official Mobile</span>
                      <span className="font-mono text-white">{card.phone}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Joining Date</span>
                      <span className="text-slate-300">{card.joinedDate}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Emergency Intimation</span>
                      <span className="font-semibold text-rose-400">{card.emergencyContact}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                    <b>Property of Fleet 365 Operations:</b> This credential remains the property of the issuing organization. If found, please return to Fleet 365 Command Operations or contact customer helpline.
                  </div>
                </div>
              )}

              {/* Magnetic Strip & Barcode Emulation */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                <span className="font-mono tracking-widest">||| |||| || ||||| ||||||| ||</span>
                <span className="font-mono">ENCRYPTED RFID: 0x9F41E8</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Print / Share / Download */}
        <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-800 mt-5">
          <div className="text-xs text-slate-400">
            {isCopied && <span className="text-emerald-400 font-bold">Copied ID details to clipboard!</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Share</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-600/30 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download Badge</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
