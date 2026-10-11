import React, { useState } from 'react';
import {
  FileBarChart, Download, Calendar, Filter, IndianRupee,
  Car, Fuel, Wrench, TrendingUp, CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { formatINR } from '@fleetwise/shared';

const mockVehicleReports = [
  {
    reg: 'TN01BV4589',
    model: 'Dzire Tour CNG',
    trips: 52,
    totalKm: 3640,
    grossRevenue: 8580000, // ₹85,800
    fuelCost: 1290000,    // ₹12,900
    maintenance: 450000,   // ₹4,500
    netProfit: 6840000,    // ₹68,400
    profitMargin: '79.7%',
  },
  {
    reg: 'TN09CE2311',
    model: 'Aura CNG',
    trips: 48,
    totalKm: 3120,
    grossRevenue: 7920000, // ₹79,200
    fuelCost: 1120000,
    maintenance: 1100000,
    netProfit: 5700000,
    profitMargin: '72.0%',
  },
  {
    reg: 'TN02DF7812',
    model: 'Tigor EV',
    trips: 60,
    totalKm: 4200,
    grossRevenue: 10500000, // ₹1,05,000
    fuelCost: 494000,      // ₹4,940 (EV low cost!)
    maintenance: 120000,
    netProfit: 9886000,
    profitMargin: '94.1%',
  },
  {
    reg: 'TN10AK9944',
    model: 'Innova Crysta',
    trips: 22,
    totalKm: 5500,
    grossRevenue: 13200000, // ₹1,32,000
    fuelCost: 3690000,
    maintenance: 450000,
    netProfit: 9060000,
    profitMargin: '68.6%',
  },
];

const mockComparisonChart = [
  { name: 'Dzire CNG', Revenue: 85800, Fuel: 12900, Net: 68400 },
  { name: 'Aura CNG', Revenue: 79200, Fuel: 11200, Net: 57000 },
  { name: 'Tigor EV', Revenue: 105000, Fuel: 4940, Net: 98860 },
  { name: 'Innova', Revenue: 132000, Fuel: 36900, Net: 90600 },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState('mtd');

  const exportCSV = () => {
    const headers = ['Registration', 'Model', 'Trips', 'Total KM', 'Gross Revenue (₹)', 'Fuel Cost (₹)', 'Maintenance (₹)', 'Net Profit (₹)', 'Margin'];
    const rows = mockVehicleReports.map((r) => [
      r.reg,
      r.model,
      r.trips,
      r.totalKm,
      (r.grossRevenue / 100).toFixed(2),
      (r.fuelCost / 100).toFixed(2),
      (r.maintenance / 100).toFixed(2),
      (r.netProfit / 100).toFixed(2),
      r.profitMargin,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FleetWise_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-cyan-400" />
            Fleet Reports & Business Intelligence
          </h1>
          <p className="text-sm text-slate-400">
            Per-vehicle profitability, fuel burn analysis, and automated audit ledger exports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="form-input text-sm w-36"
          >
            <option value="mtd">This Month (MTD)</option>
            <option value="last_month">Last Month</option>
            <option value="ytd">Year to Date (YTD)</option>
          </select>
          <button
            onClick={exportCSV}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-white mb-1">
          Vehicle Performance Comparison (Revenue vs Fuel vs Net)
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Notice how the Tigor EV delivers the highest net margin due to minimal energy running costs.
        </p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockComparisonChart} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Fuel" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-Vehicle Ledger Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">Per-Vehicle Profitability Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="py-3.5 px-4">Vehicle</th>
                <th className="py-3.5 px-4">Trips</th>
                <th className="py-3.5 px-4">Distance</th>
                <th className="py-3.5 px-4">Gross Revenue</th>
                <th className="py-3.5 px-4">Fuel Spend</th>
                <th className="py-3.5 px-4">Repairs</th>
                <th className="py-3.5 px-4 text-right">Net Profit</th>
                <th className="py-3.5 px-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {mockVehicleReports.map((row) => (
                <tr key={row.reg} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-200 block">{row.reg}</span>
                    <span className="text-xs text-slate-400">{row.model}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{row.trips}</td>
                  <td className="py-3 px-4 text-cyan-400 font-medium">{row.totalKm.toLocaleString('en-IN')} km</td>
                  <td className="py-3 px-4 text-white font-medium">{formatINR(row.grossRevenue)}</td>
                  <td className="py-3 px-4 text-amber-400">{formatINR(row.fuelCost)}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{formatINR(row.maintenance)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">{formatINR(row.netProfit)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-cyan-300">{row.profitMargin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
