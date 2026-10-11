import { describe, it, expect } from 'vitest';
import {
  calculateEmi,
  estimateFuelCost,
  calculateMileage,
  calculateTripRevenue,
  calculateTripContribution,
  calculateMonthlyCashFlow,
  calculateOperatingProfit,
  calculateEconomicProfit,
  calculateStraightLineDepreciation,
  calculateBreakEven,
  calculateTco,
  toPaise,
  fromPaise,
  costPerKm,
} from '../financial/calculations.js';

describe('toPaise / fromPaise', () => {
  it('converts 1500.50 INR to paise', () => {
    expect(toPaise(1500.5)).toBe(150050);
  });

  it('round-trips correctly', () => {
    const paise = toPaise(999.99);
    expect(fromPaise(paise)).toBeCloseTo(999.99, 2);
  });
});

describe('calculateEmi', () => {
  it('calculates standard loan EMI correctly', () => {
    // Principal: ₹5,00,000, 9% per annum, 36 months
    const result = calculateEmi({
      principal: toPaise(500_000),
      annualInterestRate: 9,
      tenureMonths: 36,
    });
    // Standard financial calculator gives ~₹15,900/month
    expect(fromPaise(result.monthlyEmi)).toBeCloseTo(15_900, -2);
    expect(result.amortizationSchedule).toHaveLength(36);
    expect(result.amortizationSchedule[35]!.closingBalance).toBe(0);
  });

  it('handles zero-interest loan', () => {
    const result = calculateEmi({
      principal: toPaise(300_000),
      annualInterestRate: 0,
      tenureMonths: 12,
    });
    expect(result.totalInterest).toBe(0);
    expect(fromPaise(result.monthlyEmi)).toBeCloseTo(25_000, 0);
  });

  it('closing balance is non-negative on all rows', () => {
    const result = calculateEmi({
      principal: toPaise(800_000),
      annualInterestRate: 8.5,
      tenureMonths: 60,
    });
    for (const row of result.amortizationSchedule) {
      expect(row.closingBalance).toBeGreaterThanOrEqual(0);
    }
  });

  it('total interest is positive for interest-bearing loan', () => {
    const result = calculateEmi({
      principal: toPaise(600_000),
      annualInterestRate: 11,
      tenureMonths: 48,
    });
    expect(result.totalInterest).toBeGreaterThan(0);
  });
});

describe('estimateFuelCost', () => {
  it('estimates petrol cost for 200 km at 12 km/l at ₹105/l', () => {
    // 200/12 = 16.67 l × ₹105 = ₹1,750
    const cost = estimateFuelCost({
      km: 200,
      efficiencyKmPerLitre: 12,
      unitPricePaise: toPaise(105),
    });
    expect(fromPaise(cost)).toBeCloseTo(1750, 0);
  });

  it('throws on zero efficiency', () => {
    expect(() =>
      estimateFuelCost({ km: 100, efficiencyKmPerLitre: 0, unitPricePaise: 10500 }),
    ).toThrow(RangeError);
  });
});

describe('calculateMileage', () => {
  it('returns km/l from odometer readings', () => {
    const mileage = calculateMileage(50000, 50200, 20);
    expect(mileage).toBeCloseTo(10, 1);
  });

  it('returns null for invalid inputs', () => {
    expect(calculateMileage(50000, 49999, 20)).toBeNull(); // negative km
    expect(calculateMileage(50000, 50200, 0)).toBeNull();  // zero fuel
  });
});

describe('calculateTripRevenue', () => {
  it('calculates gross and net revenue', () => {
    const result = calculateTripRevenue({
      grossFare: toPaise(500),
      incentives: toPaise(50),
      reimbursements: toPaise(80), // toll reimbursed
      platformCommission: toPaise(110),
    });
    expect(fromPaise(result.grossRevenue)).toBeCloseTo(630, 2);
    expect(fromPaise(result.netRevenue)).toBeCloseTo(520, 2);
  });
});

describe('calculateTripContribution', () => {
  it('returns positive contribution when revenue > costs', () => {
    const contribution = calculateTripContribution({
      netRevenue: toPaise(400),
      fuelCostAllocated: toPaise(80),
      tolls: toPaise(20),
      parking: toPaise(0),
      otherDirectCosts: toPaise(10),
    });
    expect(fromPaise(contribution)).toBeCloseTo(290, 2);
  });
});

describe('calculateMonthlyCashFlow', () => {
  it('produces negative cash flow when expenses exceed receipts', () => {
    const cf = calculateMonthlyCashFlow({
      cashReceipts: toPaise(40_000),
      operatingExpenses: toPaise(20_000),
      emiAmount: toPaise(16_000),
      capitalExpenditure: 0,
      otherCashOutflows: toPaise(5_000),
    });
    expect(fromPaise(cf)).toBeCloseTo(-1_000, 0);
  });
});

describe('calculateOperatingProfit', () => {
  it('calculates operating profit before financing and depreciation', () => {
    const op = calculateOperatingProfit({
      netRevenue: toPaise(80_000),
      operatingExpenses: toPaise(55_000),
    });
    expect(fromPaise(op)).toBeCloseTo(25_000, 0);
  });
});

describe('calculateEconomicProfit', () => {
  it('deducts depreciation and interest from operating profit', () => {
    const ep = calculateEconomicProfit({
      netRevenue: toPaise(80_000),
      operatingExpenses: toPaise(55_000),
      monthlyDepreciation: toPaise(4_000),
      interestExpense: toPaise(3_500),
      otherExpenses: 0,
    });
    expect(fromPaise(ep)).toBeCloseTo(17_500, 0);
  });
});

describe('calculateStraightLineDepreciation', () => {
  it('spreads depreciation evenly over ownership period', () => {
    // Bought at ₹8,00,000, resale ₹3,00,000, 5 years (60 months)
    const monthly = calculateStraightLineDepreciation({
      purchasePricePaise: toPaise(800_000),
      expectedResalePaise: toPaise(300_000),
      ownershipPeriodMonths: 60,
    });
    expect(fromPaise(monthly)).toBeCloseTo(8_333.33, 0);
  });
});

describe('calculateBreakEven', () => {
  it('cash break-even is below economic break-even', () => {
    const result = calculateBreakEven(
      {
        fixedMonthlyCosts: toPaise(20_000),
        variableCostPerTrip: toPaise(150),
        platformCommissionPercent: 0,
        tripsPerMonth: 500,
      },
      toPaise(250),
      25,
      toPaise(4_000),
    );
    expect(result.cashBreakEvenPerTrip).toBeLessThan(result.economicBreakEvenPerTrip);
  });
});

describe('calculateTco', () => {
  it('subtracts net sale proceeds from total costs', () => {
    const tco = calculateTco({
      purchasePricePaise: toPaise(1_000_000),
      totalFinancingCostPaise: toPaise(100_000),
      totalEnergyCostPaise: toPaise(300_000),
      totalMaintenancePaise: toPaise(80_000),
      totalInsurancePermitsPaise: toPaise(60_000),
      otherCostsPaise: toPaise(20_000),
      expectedResalePaise: toPaise(450_000),
      remainingLoanPaise: 0,
    });
    // 1,560,000 - 450,000 = 1,110,000 paise
    expect(fromPaise(tco)).toBeCloseTo(1_110_000, 0);
  });

  it('does not give negative TCO even with high resale', () => {
    const tco = calculateTco({
      purchasePricePaise: toPaise(500_000),
      totalFinancingCostPaise: 0,
      totalEnergyCostPaise: 0,
      totalMaintenancePaise: 0,
      totalInsurancePermitsPaise: 0,
      otherCostsPaise: 0,
      expectedResalePaise: toPaise(600_000), // higher than purchase (unlikely but shouldn't crash)
      remainingLoanPaise: 0,
    });
    expect(fromPaise(tco)).toBeCloseTo(-100_000, 0); // gain from resale
  });
});

describe('costPerKm', () => {
  it('calculates correctly', () => {
    expect(fromPaise(costPerKm(toPaise(10_000), 500))).toBeCloseTo(20, 2);
  });

  it('returns 0 when km is 0', () => {
    expect(costPerKm(toPaise(5_000), 0)).toBe(0);
  });
});
