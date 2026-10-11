import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
];

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
}

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  let lastError: string = 'No model available';

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: Record<string, unknown> = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      };

      if (systemInstruction) {
        payload['systemInstruction'] = {
          parts: [{ text: systemInstruction }],
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as GeminiResponse;

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }

      if (data.error) {
        lastError = `Model ${model}: ${data.error.message}`;
        logger.warn('Gemini model request error, attempting fallback', { model, error: data.error.message });
      }
    } catch (err: any) {
      lastError = err.message;
      logger.warn('Gemini network attempt failed, trying fallback', { model, error: err.message });
    }
  }

  throw new Error(`Gemini AI service unavailable: ${lastError}`);
}

export async function generateFleetDepthAnalysis(metrics: {
  fleetSize: number;
  activeVehicles: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  totalKm: number;
  costPerKm: number;
  revenuePerKm: number;
  topVehicles?: Array<{ reg: string; model: string; margin: string }>;
}): Promise<string> {
  const systemPrompt = `You are FleetWise AI, an expert Chief Financial Officer and Commercial Taxi Business Operations Analyst in India.
Provide crisp, highly actionable, bulleted financial analysis with exact rupee numbers, profitability ratios, and operational improvements. Keep the tone executive, sharp, and encouraging. Focus on Indian taxi economics (Ola, Uber, IT contracts, CNG vs EV savings, empty running reduction).`;

  const userPrompt = `Perform a comprehensive in-depth business & operational analysis for this taxi fleet:
- Fleet Size: ${metrics.fleetSize} vehicles (${metrics.activeVehicles} active on trips)
- Monthly Net Revenue: ₹${(metrics.monthlyRevenue / 100).toLocaleString('en-IN')}
- Monthly Operational Costs: ₹${(metrics.monthlyExpenses / 100).toLocaleString('en-IN')}
- Monthly Net Take-Home: ₹${(metrics.monthlyProfit / 100).toLocaleString('en-IN')}
- Total Fleet Distance: ${metrics.totalKm.toLocaleString('en-IN')} km
- Cost per KM: ₹${(metrics.costPerKm / 100).toFixed(2)}
- Revenue per KM: ₹${(metrics.revenuePerKm / 100).toFixed(2)}

Please structure your depth analysis into 4 sections:
1. 📊 Executive Performance Audit (Margin health, cash-flow stability)
2. ⛽ Cost Leakage & Fuel Optimization (Tire wear, empty km, maintenance reserve)
3. ⚡ Fleet Transition Advisory (CNG vs EV ROI and asset utilization)
4. 🚀 3 Immediate Action Items to Boost Net Profit by 15-20% this month.`;

  return callGemini(userPrompt, systemPrompt);
}

export async function generateSimulationAdvisor(scenario: {
  vehicleModel: string;
  fuelType: string;
  onRoadPrice: number;
  monthlyEmi: number;
  monthlyRevenue: number;
  monthlyFuelCost: number;
  monthlyNetProfit: number;
  breakEvenTripsPerDay: number;
}): Promise<string> {
  const systemPrompt = `You are FleetWise AI, a specialised taxi investment risk advisor in India. Evaluate vehicle purchase viability, EMI risk exposure, and break-even feasibility.`;

  const userPrompt = `Evaluate this taxi investment simulation:
- Proposed Vehicle: ${scenario.vehicleModel} (${scenario.fuelType.toUpperCase()})
- On-Road Cost: ₹${(scenario.onRoadPrice / 100).toLocaleString('en-IN')}
- Monthly Loan EMI: ₹${(scenario.monthlyEmi / 100).toLocaleString('en-IN')}
- Estimated Monthly Net Revenue: ₹${(scenario.monthlyRevenue / 100).toLocaleString('en-IN')}
- Monthly Fuel Cost: ₹${(scenario.monthlyFuelCost / 100).toLocaleString('en-IN')}
- Net In-Pocket Cash Flow: ₹${(scenario.monthlyNetProfit / 100).toLocaleString('en-IN')}
- Daily Break-Even: ${scenario.breakEvenTripsPerDay} trips/day

Provide:
1. 💡 Investment Verdict (Approve / Caution / Reject with justification)
2. ⚠️ Downside Risk Exposure (What happens if fuel rises by 10% or cancellations hit 15%?)
3. ⏱️ Capital Payback Horizon (Time to recover initial down payment)
4. 🎯 Optimization Tip (How to compress EMI impact or maximize paid km).`;

  return callGemini(userPrompt, systemPrompt);
}

export async function chatWithFleetAI(message: string, context?: Record<string, unknown>): Promise<string> {
  const systemPrompt = `You are FleetWise AI, an on-demand commercial fleet intelligence assistant. You help fleet owners, taxi operators, and transport managers in India optimize earnings, minimize empty running, manage drivers, calculate EMIs, and understand tax/GST rules. Answer concisely, practically, and ground your answers in real Indian market numbers (INR).`;

  const fullPrompt = context
    ? `Fleet Context: ${JSON.stringify(context, null, 2)}\n\nUser Question: ${message}`
    : message;

  return callGemini(fullPrompt, systemPrompt);
}
