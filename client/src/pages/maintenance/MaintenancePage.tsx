import React, { useState } from 'react';
import {
  Wrench, AlertTriangle, CheckCircle2, Clock, Calendar,
  Gauge, Plus, IndianRupee, Car, X, ShieldAlert
} from 'lucide-react';
import { formatINR } from '@fleetwise/shared';

interface MaintenanceTask {
  _id: string;
  vehicleRegistration: string;
  taskName: string;
  intervalKm: number;
  lastDoneOdometer: number;
  currentOdometer: number;
  nextDueOdometer: number;
  status: 'good' | 'due_soon' | 'overdue';
  estimatedCost: number;
}

const mockTasks: MaintenanceTask[] = [
  {
    _id: 'm1',
    vehicleRegistration: 'TN01BV4589',
    taskName: 'Engine Oil & Filter Change',
    intervalKm: 10000,
    lastDoneOdometer: 35000,
    currentOdometer: 42150,
    nextDueOdometer: 45000,
    status: 'good',
    estimatedCost: 350000, // ₹3,500
  },
  {
    _id: 'm2',
    vehicleRegistration: 'TN09CE2311',
    taskName: 'Brake Pad Inspection & Replacement',
    intervalKm: 20000,
    lastDoneOdometer: 50000,
    currentOdometer: 68400,
    nextDueOdometer: 70000,
    status: 'due_soon',
    estimatedCost: 280000,
  },
  {
    _id: 'm3',
    vehicleRegistration: 'TN10AK9944',
    taskName: 'Coolant Flush & Radiator Clean',
    intervalKm: 40000,
    lastDoneOdometer: 70000,
    currentOdometer: 112000,
    nextDueOdometer: 110000,
    status: 'overdue',
    estimatedCost: 450000,
  },
  {
    _id: 'm4',
    vehicleRegistration: 'TN02DF7812',
    taskName: 'Tyre Rotation & Wheel Balancing',
    intervalKm: 10000,
    lastDoneOdometer: 10000,
    currentOdometer: 14200,
    nextDueOdometer: 20000,
    status: 'good',
    estimatedCost: 120000,
  },
];

export default function MaintenancePage() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>(mockTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    vehicleRegistration: 'TN01BV4589',
    taskName: 'General Inspection',
    currentOdometer: 42150,
    nextDueOdometer: 52150,
    costINR: 2500,
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: MaintenanceTask = {
      _id: 'm_' + Date.now(),
      vehicleRegistration: form.vehicleRegistration,
      taskName: form.taskName,
      intervalKm: 10000,
      lastDoneOdometer: form.currentOdometer,
      currentOdometer: form.currentOdometer,
      nextDueOdometer: form.nextDueOdometer,
      status: 'good',
      estimatedCost: form.costINR * 100,
    };
    setTasks([newTask, ...tasks]);
    setIsModalOpen(false);
  };

  const getStatusBadge = (status: MaintenanceTask['status']) => {
    switch (status) {
      case 'overdue':
        return <span className="badge badge-danger">⚠️ Overdue</span>;
      case 'due_soon':
        return <span className="badge badge-warning">⚡ Due in &lt;2,000 km</span>;
      default:
        return <span className="badge badge-success">✓ Health OK</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wrench className="w-7 h-7 text-brand-400" />
            Fleet Health & Maintenance
          </h1>
          <p className="text-sm text-slate-400">
            Prevent roadside breakdowns with odometer-triggered periodic service intervals
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Schedule Service
        </button>
      </div>

      {/* Overdue Alert Banner if any */}
      {tasks.some((t) => t.status === 'overdue') && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-200">Immediate Action Required</h4>
            <p className="text-xs text-rose-300/80 mt-0.5">
              1 vehicle has exceeded its recommended maintenance interval by 2,000+ km. Schedule a service to avoid engine warranty invalidation.
            </p>
          </div>
        </div>
      )}

      {/* Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map((task) => {
          const remainingKm = task.nextDueOdometer - task.currentOdometer;
          const progressPercent = Math.min(100, Math.max(0, 100 - (remainingKm / task.intervalKm) * 100));

          return (
            <div key={task._id} className="glass-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">{task.taskName}</h3>
                  <p className="text-xs text-brand-400 font-semibold mt-0.5">{task.vehicleRegistration}</p>
                </div>
                {getStatusBadge(task.status)}
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
                  <span>Current: {task.currentOdometer.toLocaleString('en-IN')} km</span>
                  <span>Due: {task.nextDueOdometer.toLocaleString('en-IN')} km</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      task.status === 'overdue'
                        ? 'bg-rose-500'
                        : task.status === 'due_soon'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400">
                  Estimated Cost: <strong className="text-slate-200">{formatINR(task.estimatedCost)}</strong>
                </span>
                <button className="text-xs font-semibold text-brand-400 hover:text-brand-300">
                  Mark Completed
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 relative border-slate-700">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-brand-400" />
              Schedule Maintenance Task
            </h2>
            <p className="text-xs text-slate-400 mb-5">Set up odometer thresholds for periodic maintenance alerts.</p>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="form-label">Vehicle Registration</label>
                <input
                  type="text"
                  required
                  value={form.vehicleRegistration}
                  onChange={(e) => setForm({ ...form, vehicleRegistration: e.target.value })}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Service Item</label>
                <input
                  type="text"
                  required
                  value={form.taskName}
                  onChange={(e) => setForm({ ...form, taskName: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Current Odometer (km)</label>
                  <input
                    type="number"
                    required
                    value={form.currentOdometer}
                    onChange={(e) => setForm({ ...form, currentOdometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Due At Odometer (km)</label>
                  <input
                    type="number"
                    required
                    value={form.nextDueOdometer}
                    onChange={(e) => setForm({ ...form, nextDueOdometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Budgeted Cost (₹)</label>
                <input
                  type="number"
                  required
                  value={form.costINR}
                  onChange={(e) => setForm({ ...form, costINR: Number(e.target.value) })}
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Set Maintenance Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
