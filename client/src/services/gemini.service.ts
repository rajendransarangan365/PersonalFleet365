import { apiPost } from './api.js';

const FALLBACK_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
];

export async function runFleetDepthAnalysis(
  businessId: string | null,
  metrics: {
    fleetSize: number;
    activeVehicles: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    monthlyProfit: number;
    totalKm: number;
    costPerKm: number;
    revenuePerKm: number;
  }
): Promise<string> {
  // 1. Try via Backend API if active business exists
  if (businessId) {
    try {
      const res = await apiPost<{ analysis: string }>(
        `/businesses/${businessId}/analytics/ai-analysis`,
        metrics
      );
      if (res && res.analysis) return res.analysis;
    } catch {
      // Fallback to direct client-side call for standalone APK / offline mode
    }
  }

  // 2. Direct client-side call (works in standalone APK and preview mode)
  const prompt = `Perform a comprehensive in-depth business & operational analysis for this Indian taxi fleet:
- Fleet Size: ${metrics.fleetSize} vehicles (${metrics.activeVehicles} active on duty)
- Monthly Net Revenue: ₹${(metrics.monthlyRevenue / 100).toLocaleString('en-IN')}
- Monthly Operational Costs: ₹${(metrics.monthlyExpenses / 100).toLocaleString('en-IN')}
- Monthly Net Take-Home: ₹${(metrics.monthlyProfit / 100).toLocaleString('en-IN')}
- Total Fleet Distance: ${metrics.totalKm.toLocaleString('en-IN')} km
- Cost per KM: ₹${(metrics.costPerKm / 100).toFixed(2)}
- Revenue per KM: ₹${(metrics.revenuePerKm / 100).toFixed(2)}

Please structure your depth analysis into 4 sections:
1. 📊 Executive Performance Audit (Margin health, cash-flow stability)
2. ⛽ Cost Leakage & Fuel Optimization (Tire wear, empty running reduction)
3. ⚡ Fleet Transition Advisory (CNG vs EV upgrade ROI)
4. 🚀 3 Immediate Action Items to Boost Net Profit by 15-20% this month.`;

  return callDirectGemini(prompt);
}

export async function runSimulationAdvisorAI(
  businessId: string | null,
  scenario: {
    vehicleModel: string;
    fuelType: string;
    onRoadPrice: number;
    monthlyEmi: number;
    monthlyRevenue: number;
    monthlyFuelCost: number;
    monthlyNetProfit: number;
    breakEvenTripsPerDay: number;
  }
): Promise<string> {
  if (businessId) {
    try {
      const res = await apiPost<{ advice: string }>(
        `/businesses/${businessId}/analytics/ai-simulation-advisor`,
        scenario
      );
      if (res && res.advice) return res.advice;
    } catch {
      // Fallback to direct call
    }
  }

  const prompt = `Evaluate this taxi vehicle investment simulation in India:
- Proposed Vehicle: ${scenario.vehicleModel} (${scenario.fuelType.toUpperCase()})
- On-Road Cost: ₹${(scenario.onRoadPrice / 100).toLocaleString('en-IN')}
- Monthly Loan EMI: ₹${(scenario.monthlyEmi / 100).toLocaleString('en-IN')}
- Estimated Monthly Net Revenue: ₹${(scenario.monthlyRevenue / 100).toLocaleString('en-IN')}
- Monthly Fuel Cost: ₹${(scenario.monthlyFuelCost / 100).toLocaleString('en-IN')}
- Net In-Pocket Cash Flow: ₹${(scenario.monthlyNetProfit / 100).toLocaleString('en-IN')}
- Daily Break-Even: ${scenario.breakEvenTripsPerDay} trips/day

Provide:
1. 💡 Investment Verdict (Approve / Caution / Reject with reasons)
2. ⚠️ Downside Risk Exposure (Sensitivity to fuel price rises or trip cancellations)
3. ⏱️ Capital Payback Horizon (Time to recover initial down payment)
4. 🎯 Optimization Tip (How to compress EMI impact or maximize paid km).`;

  return callDirectGemini(prompt);
}

export async function askGeminiFleetAI(message: string, context?: Record<string, unknown>): Promise<string> {
  const prompt = context
    ? `Fleet Context: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${message}`
    : message;

  return callDirectGemini(prompt);
}

async function callDirectGemini(prompt: string): Promise<string> {
  let lastError = 'No model available';

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${FALLBACK_GEMINI_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{
              text: 'You are FleetWise AI, an expert Chief Financial Officer and Commercial Taxi Business Operations Analyst in India. Provide crisp, realistic, bulleted financial analysis with exact rupee numbers.',
            }],
          },
        }),
      });

      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        lastError = data.error.message;
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(`Gemini AI service unavailable: ${lastError}`);
}
