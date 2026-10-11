import React, { useState, useEffect } from 'react';
import {
  Car, Plus, Search, Filter, Fuel, Gauge, AlertCircle,
  CheckCircle2, Wrench, Shield, ChevronRight, X, Camera,
  Sparkles
} from 'lucide-react';
import { apiGet, apiPost } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';
import { formatINR } from '@fleetwise/shared';
import VehiclePhotoGalleryModal from '../../components/VehiclePhotoGalleryModal.js';
import OnboardingWizardModal from '../../components/OnboardingWizardModal.js';

interface Vehicle {
  _id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  fuelType: 'petrol' | 'diesel' | 'cng' | 'hybrid' | 'electric';
  status: 'active' | 'available' | 'assigned' | 'in_service' | 'breakdown' | 'inactive';
  currentOdometer: number;
  purchasePrice: number;
  seatingCapacity: number;
}

const mockVehicles: Vehicle[] = [
  {
    _id: 'v1',
    registrationNumber: 'TN01BV4589',
    make: 'Maruti Suzuki',
    model: 'Dzire Tour S',
    year: 2023,
    fuelType: 'cng',
    status: 'active',
    currentOdometer: 42150,
    purchasePrice: 78000000, // ₹7.8L in paise
    seatingCapacity: 5,
  },
  {
    _id: 'v2',
    registrationNumber: 'TN09CE2311',
    make: 'Hyundai',
    model: 'Aura CNG',
    year: 2022,
    fuelType: 'cng',
    status: 'assigned',
    currentOdometer: 68400,
    purchasePrice: 82000000,
    seatingCapacity: 5,
  },
  {
    _id: 'v3',
    registrationNumber: 'TN02DF7812',
    make: 'Tata',
    model: 'Tigor EV',
    year: 2024,
    fuelType: 'electric',
    status: 'active',
    currentOdometer: 14200,
    purchasePrice: 125000000,
    seatingCapacity: 5,
  },
  {
    _id: 'v4',
    registrationNumber: 'TN10AK9944',
    make: 'Toyota',
    model: 'Innova Crysta',
    year: 2021,
    fuelType: 'diesel',
    status: 'in_service',
    currentOdometer: 112000,
    purchasePrice: 195000000,
    seatingCapacity: 7,
  },
];

export default function VehiclesPage() {
  const { activeBusinessId } = useAuthStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVehicleForPhotos, setSelectedVehicleForPhotos] = useState<Vehicle | null>(null);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    registrationNumber: '',
    make: '',
    model: '',
    year: 2023,
    fuelType: 'cng' as const,
    currentOdometer: 0,
    purchasePriceINR: 800000,
    seatingCapacity: 5,
  });

  useEffect(() => {
    if (!activeBusinessId) return;
    loadVehicles();
  }, [activeBusinessId]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const res = await apiGet<Vehicle[]>(`/businesses/${activeBusinessId}/vehicles`);
      if (Array.isArray(res) && res.length > 0) {
        setVehicles(res);
      }
    } catch {
      // Fallback to local mock data for preview/offline
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle: Vehicle = {
      _id: 'v_' + Date.now(),
      registrationNumber: formData.registrationNumber.toUpperCase().trim(),
      make: formData.make.trim(),
      model: formData.model.trim(),
      year: Number(formData.year),
      fuelType: formData.fuelType,
      status: 'active',
      currentOdometer: Number(formData.currentOdometer),
      purchasePrice: Number(formData.purchasePriceINR) * 100,
      seatingCapacity: Number(formData.seatingCapacity),
    };

    try {
      if (activeBusinessId) {
        await apiPost(`/businesses/${activeBusinessId}/vehicles`, {
          ...newVehicle,
          purchasePrice: newVehicle.purchasePrice,
          purchaseDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch {
      // Local addition
    }

    setVehicles([newVehicle, ...vehicles]);
    setIsAddModalOpen(false);
    setFormData({
      registrationNumber: '',
      make: '',
      model: '',
      year: 2023,
      fuelType: 'cng',
      currentOdometer: 0,
      purchasePriceINR: 800000,
      seatingCapacity: 5,
    });
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Vehicle['status']) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'assigned':
        return <span className="badge badge-info">On Duty</span>;
      case 'in_service':
        return <span className="badge badge-warning">In Service</span>;
      case 'breakdown':
        return <span className="badge badge-danger">Breakdown</span>;
      default:
        return <span className="badge bg-slate-700 text-slate-300">Available</span>;
    }
  };

  const getFuelBadge = (fuel: Vehicle['fuelType']) => {
    switch (fuel) {
      case 'electric':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">⚡ Electric</span>;
      case 'cng':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">🟢 CNG</span>;
      case 'diesel':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40">⛽ Diesel</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">Petrol</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Car className="w-7 h-7 text-brand-400" />
            Fleet Vehicles
          </h1>
          <p className="text-sm text-slate-400">
            Monitor odometer readings, fuel types, EMI investments, and service health
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="btn-secondary flex items-center justify-center gap-1.5 text-brand-400 border-brand-500/30 hover:bg-brand-500/10 text-xs sm:text-sm py-2 px-3"
          >
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Fast Onboarding Wizard</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm py-2 px-3"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
        </div>
      </div>

      {/* Fleet Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Total Fleet</p>
          <p className="text-2xl font-bold text-white mt-1">{vehicles.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Active on Trips</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {vehicles.filter((v) => v.status === 'active' || v.status === 'assigned').length}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">In Maintenance</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {vehicles.filter((v) => v.status === 'in_service' || v.status === 'breakdown').length}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Total Valuation</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">
            {formatINR(vehicles.reduce((acc, v) => acc + (v.purchasePrice || 0), 0))}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by registration number, make, or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input w-40 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="assigned">On Duty</option>
            <option value="in_service">In Service</option>
            <option value="breakdown">Breakdown</option>
          </select>
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <div
            key={vehicle._id}
            className="glass-card p-5 hover:border-brand-500/40 transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide group-hover:text-brand-400 transition-colors">
                    {vehicle.registrationNumber}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {vehicle.make} {vehicle.model} ({vehicle.year})
                  </p>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 my-4 py-3 border-y border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Odometer</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    {vehicle.currentOdometer.toLocaleString('en-IN')} km
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Fuel Type</span>
                  {getFuelBadge(vehicle.fuelType)}
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Capacity</span>
                  <span className="font-semibold text-slate-200">
                    {vehicle.seatingCapacity} Seater
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Asset Value</span>
                  <span className="font-semibold text-slate-200">
                    {formatINR(vehicle.purchasePrice)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
              <button
                onClick={() => setSelectedVehicleForPhotos(vehicle)}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors"
                title="View/Upload 4-Angle Handover Proof Photos"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>4-Angle Photos Proof</span>
              </button>
              <button className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Manage <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Car className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No vehicles found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or add your first vehicle.</p>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 relative border-slate-700 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-400" />
              Add New Vehicle
            </h2>
            <p className="text-xs text-slate-400 mb-5">Enter registration and specification details for your fleet asset.</p>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="form-label">Registration Number (e.g. TN01AB1234)</label>
                <input
                  type="text"
                  required
                  placeholder="TN01BV4589"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value.toUpperCase() })}
                  className="form-input uppercase tracking-wider font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Make</label>
                  <input
                    type="text"
                    required
                    placeholder="Maruti Suzuki"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Model</label>
                  <input
                    type="text"
                    required
                    placeholder="Dzire Tour"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    min="2010"
                    max="2026"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Fuel Type</label>
                  <select
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
                    className="form-input"
                  >
                    <option value="cng">CNG</option>
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Petrol</option>
                    <option value="electric">Electric (EV)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Seats</label>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={formData.seatingCapacity}
                    onChange={(e) => setFormData({ ...formData, seatingCapacity: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Current Odometer (km)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentOdometer}
                    onChange={(e) => setFormData({ ...formData, currentOdometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">On-Road Price (₹ INR)</label>
                  <input
                    type="number"
                    min="100000"
                    step="10000"
                    required
                    value={formData.purchasePriceINR}
                    onChange={(e) => setFormData({ ...formData, purchasePriceINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Photo Gallery Modal */}
      {selectedVehicleForPhotos && (
        <VehiclePhotoGalleryModal
          isOpen={!!selectedVehicleForPhotos}
          onClose={() => setSelectedVehicleForPhotos(null)}
          vehicleId={selectedVehicleForPhotos._id}
          registrationNumber={selectedVehicleForPhotos.registrationNumber}
          userRole="owner"
        />
      )}

      {/* Fast Fleet Onboarding Wizard Modal */}
      {isOnboardingModalOpen && (
        <OnboardingWizardModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
          onSuccess={() => {
            loadVehicles();
          }}
        />
      )}
    </div>
  );
}
