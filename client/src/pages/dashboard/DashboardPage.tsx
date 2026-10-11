import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Car, MapPin, Fuel, AlertTriangle,
  ArrowUpRight, ArrowDownRight, IndianRupee, Activity, Clock, Gauge, Wrench,
  Sparkles, Bot, Send, Loader2, CheckCircle2, X
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Legend
} from 'recharts';
import { formatINR } from '@fleetwise/shared';
import { runFleetDepthAnalysis, askGeminiFleetAI } from '../../services/gemini.service.js';
import { useAuthStore } from '../../store/auth.store.js';

// ─── Mock data (replace with real API calls in subsequent phases) ─────────────

const mockMonthlyData = [
  { month: 'May', revenue: 85000, expenses: 62000, profit: 23000 },
  { month: 'Jun', revenue: 92000, expenses: 68000, profit: 24000 },
  { month: 'Jul', revenue: 78000, expenses: 59000, profit: 19000 },
  { month: 'Aug', revenue: 95000, expenses: 71000, profit: 24000 },
  { month: 'Sep', revenue: 102000, expenses: 75000, profit: 27000 },
  { month: 'Oct', revenue: 98000, expenses: 72000, profit: 26000 },
];

const mockKpiData = [
  { label: "Today's Revenue", value: '₹3,840', change: +12.4, icon: IndianRupee, color: 'text-success' },
  { label: 'Monthly Profit', value: '₹26,400', change: +8.1, icon: TrendingUp, color: 'text-success' },
  { label: 'Cost per KM', value: '₹8.20', change: -3.2, icon: Gauge, color: 'text-warning' },
  { label: 'Active Vehicles', value: '3 / 4', change: 0, icon: Car, color: 'text-brand-400' },
  { label: 'Trips Today', value: '12', change: +2, icon: MapPin, color: 'text-cyan-400' },
  { label: 'EMI Due', value: '₹15,900', change: 0, icon: Activity, color: 'text-warning' },
];

const mockAlerts = [
  { id: 1, type: 'warning', msg: 'TN01AB1234 — Oil service due in 500 km', icon: Wrench },
  { id: 2, type: 'danger', msg: 'Insurance expiry in 12 days — TN03CD5678', icon: AlertTriangle },
  { id: 3, type: 'info', msg: 'Contract with Cognizant renews on Nov 1', icon: Clock },
];

// ─── Recharts custom tooltip ──────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1 min-w-32 shadow-xl">
      <p className="font-semibold text-slate-300 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="text-slate-400">{entry.name}</span>
          <span className="font-semibold" style={{ color: entry.color }}>
            ₹{entry.value.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { activeBusinessId } = useAuthStore();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Quick Q&A with Gemini
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleRunAiAnalysis = async () => {
    try {
      setIsAiLoading(true);
      setIsAiModalOpen(true);
      const result = await runFleetDepthAnalysis(activeBusinessId, {
        fleetSize: 4,
        activeVehicles: 3,
        monthlyRevenue: 9800000,
        monthlyExpenses: 7200000,
        monthlyProfit: 2600000,
        totalKm: 4820,
        costPerKm: 820,
        revenuePerKm: 2030,
      });
      setAiAnalysis(result);
    } catch (err: any) {
      setAiAnalysis(`Failed to run AI analysis: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;
    try {
      setIsChatLoading(true);
      const reply = await askGeminiFleetAI(chatQuestion, {
        fleetSize: 4,
        vehicles: ['Dzire Tour CNG', 'Aura CNG', 'Tigor EV', 'Innova Diesel'],
        monthlyProfitINR: 26400,
        costPerKmINR: 8.2,
      });
      setChatAnswer(reply);
    } catch (err: any) {
      setChatAnswer(`Error: ${err.message}`);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="page space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Fleet Dashboard</h1>
          <p className="page-subtitle">Sunday, 11 October 2026 · Tamil Nadu, India</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select text-xs py-1.5 px-3 w-auto" id="date-range-picker">
            <option>This Month</option>
            <option>Last Month</option>
            <option>Last 3 Months</option>
            <option>This Year</option>
          </select>
        </div>
      </div>

      {/* Gemini AI Depth Analysis Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-950/70 via-slate-900/90 to-purple-950/70 border border-brand-500/30 p-5 shadow-xl shadow-brand-950/40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                Gemini 3.5 Flash · Free Tier API Active
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Career App AI Key Grounded</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              AI Fleet & Profitability Depth Diagnostic
            </h3>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Synthesizes real trip logs, odometer continuity, CNG/EV consumption curves, and EMI commitments to deliver CFO-grade margin optimization advice.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiLoading}
              className="btn-primary flex items-center justify-center gap-2 text-xs py-2.5 px-4 shadow-lg shadow-brand-500/25 whitespace-nowrap"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Depth Diagnostic...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  Run AI Depth Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Question bar */}
        <form onSubmit={handleSendQuestion} className="mt-4 pt-3 border-t border-slate-800/80 flex gap-2">
          <div className="relative flex-1">
            <Bot className="w-4 h-4 text-brand-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ask Gemini AI (e.g. 'How can I reduce empty running with 4 cars?' or 'Is CNG or EV better in Chennai?')..."
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              className="form-input pl-9 text-xs py-2 bg-slate-900/80 border-slate-700/80"
            />
          </div>
          <button
            type="submit"
            disabled={isChatLoading || !chatQuestion.trim()}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 whitespace-nowrap"
          >
            {isChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Ask AI
          </button>
        </form>

        {chatAnswer && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-brand-500/30 text-xs text-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] text-brand-400 font-semibold mb-1.5">
              <span className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> FleetWise AI Response
              </span>
              <button
                onClick={() => setChatAnswer(null)}
                className="text-slate-500 hover:text-slate-300 text-[10px]"
              >
                Clear
              </button>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-slate-300">
              {chatAnswer}
            </div>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {mockKpiData.map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="kpi-card group glass-card-hover">
            <div className="flex items-center justify-between">
              <div className={`w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center ${color}`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              {change !== 0 && (
                <span className={change > 0 ? 'kpi-change-up' : 'kpi-change-down'}>
                  {change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(change)}%
                </span>
              )}
            </div>
            <div>
              <p className="kpi-value">{value}</p>
              <p className="kpi-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue vs Expenses (wide) */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Revenue vs Expenses</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-400 inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />Expenses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockMonthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Profit Bar */}
        <div className="glass-card p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-200">Monthly Profit</h3>
            <p className="text-xs text-slate-500 mt-0.5">Operating profit trend</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockMonthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Alerts & Reminders</h3>
            <span className="badge badge-warning">{mockAlerts.length} active</span>
          </div>
          <div className="space-y-3">
            {mockAlerts.map((alert) => {
              const Icon = alert.icon;
              const colorClass = alert.type === 'danger' ? 'text-danger bg-danger/10 border-danger/20'
                : alert.type === 'warning' ? 'text-warning bg-warning/10 border-warning/20'
                : 'text-brand-400 bg-brand-500/10 border-brand-500/20';
              return (
                <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${colorClass}`}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">{alert.msg}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick stats */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Fleet Overview</h3>
          <div className="space-y-4">
            {[
              { label: 'Total KM this month', value: '4,820 km', color: 'bg-brand-500' },
              { label: 'Fuel cost this month', value: '₹24,600', color: 'bg-orange-500' },
              { label: 'Pending payments', value: '₹12,500', color: 'bg-warning' },
              { label: 'Emergency reserve', value: '₹45,000', color: 'bg-success' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-1.5 h-10 rounded-full ${color} flex-shrink-0`} />
                <div className="flex-1">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Empty state hint */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-700 text-center">
            <p className="text-xs text-slate-500">Add your first trip to see real-time data</p>
            <a href="/trips" className="btn-primary btn-sm mt-2 inline-flex">Add Trip</a>
          </div>
        </div>
      </div>

      {/* Gemini AI Depth Analysis Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-3xl p-6 relative border-brand-500/40 max-h-[85vh] flex flex-col shadow-2xl shadow-brand-950/60">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Gemini AI · Commercial Fleet Depth Diagnostic
                </h2>
                <p className="text-xs text-brand-400 font-semibold">
                  Google AI Studio Free Tier · Gemini 3.5 Flash Model
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
              {isAiLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 border-t-brand-400 animate-spin" />
                    <Sparkles className="w-6 h-6 text-brand-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      Analyzing Fleet Financials & Operating Margins...
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Synthesizing odometer curves, empty running costs, and CNG vs EV migration feasibility via Gemini Free Tier.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 whitespace-pre-wrap leading-relaxed font-sans text-[13px] text-slate-200">
                    {aiAnalysis}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Grounded on your Career App API Key · Zero Cloud Surcharge
              </span>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
