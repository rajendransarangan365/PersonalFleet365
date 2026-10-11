export interface IndianVehiclePreset {
  id: string;
  name: string;
  make: string;
  model: string;
  variant: string;
  fuelType: 'cng' | 'diesel' | 'electric' | 'petrol';
  seatingCapacity: number;
  category: 'sedan' | 'mpv' | 'suv' | 'cargo';
  claimedMileage: number; // km/kg, km/L, or km/kWh
  expectedMileage: number;
  unit: string;
  onRoadPriceINR: number;
  defaultDownPaymentINR: number;
  defaultTenureMonths: number;
  defaultInterestRate: number;
  estimatedEmiINR: number;
  adBlueRequired: boolean;
  adBlueLitersPer1000Km?: number;
  imageUrl: string;
  description: string;
}

export const INDIAN_COMMERCIAL_VEHICLES: IndianVehiclePreset[] = [
  {
    id: 'dzire_tour_s',
    name: 'Maruti Suzuki Dzire Tour S (CNG)',
    make: 'Maruti Suzuki',
    model: 'Dzire Tour S',
    variant: '1.2L DualJet CNG',
    fuelType: 'cng',
    seatingCapacity: 4,
    category: 'sedan',
    claimedMileage: 31.12,
    expectedMileage: 26.5,
    unit: 'km/kg',
    onRoadPriceINR: 850000,
    defaultDownPaymentINR: 150000,
    defaultTenureMonths: 36,
    defaultInterestRate: 10.5,
    estimatedEmiINR: 22750,
    adBlueRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
    description: 'India\'s #1 most popular commercial fleet sedan. Unmatched CNG fuel economy and low maintenance costs.',
  },
  {
    id: 'ertiga_tour_m',
    name: 'Maruti Suzuki Ertiga Tour M (CNG)',
    make: 'Maruti Suzuki',
    model: 'Ertiga Tour M',
    variant: '1.5L K15C CNG',
    fuelType: 'cng',
    seatingCapacity: 7,
    category: 'mpv',
    claimedMileage: 26.11,
    expectedMileage: 21.0,
    unit: 'km/kg',
    onRoadPriceINR: 1220000,
    defaultDownPaymentINR: 200000,
    defaultTenureMonths: 48,
    defaultInterestRate: 10.5,
    estimatedEmiINR: 26100,
    adBlueRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=600&q=80',
    description: '7-Seater commercial MPV ideal for airport pick & drop, corporate employee transit, and outstation trips.',
  },
  {
    id: 'tata_tigor_ev',
    name: 'Tata Tigor EV / XPRES-T (Electric)',
    make: 'Tata Motors',
    model: 'XPRES-T EV',
    variant: 'XM+ 26 kWh',
    fuelType: 'electric',
    seatingCapacity: 4,
    category: 'sedan',
    claimedMileage: 315, // km per full charge
    expectedMileage: 230,
    unit: 'km/charge',
    onRoadPriceINR: 1380000,
    defaultDownPaymentINR: 250000,
    defaultTenureMonths: 48,
    defaultInterestRate: 9.8,
    estimatedEmiINR: 28500,
    adBlueRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=600&q=80',
    description: 'Zero-emission electric cab with ultra-low running cost (₹1.2/km) and zero state road tax.',
  },
  {
    id: 'innova_crysta',
    name: 'Toyota Innova Crysta (Diesel)',
    make: 'Toyota',
    model: 'Innova Crysta',
    variant: '2.4L GX Diesel BS6',
    fuelType: 'diesel',
    seatingCapacity: 7,
    category: 'suv',
    claimedMileage: 15.6,
    expectedMileage: 12.5,
    unit: 'km/L',
    onRoadPriceINR: 2450000,
    defaultDownPaymentINR: 450000,
    defaultTenureMonths: 60,
    defaultInterestRate: 10.0,
    estimatedEmiINR: 42500,
    adBlueRequired: true,
    adBlueLitersPer1000Km: 1.5,
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80',
    description: 'Premium intercity and outstation tourist luxury commercial vehicle with legendary durability and AdBlue BS6 compliance.',
  },
  {
    id: 'tata_ace_gold',
    name: 'Tata Ace Gold (CNG / Diesel Mini Truck)',
    make: 'Tata Motors',
    model: 'Ace Gold Plus',
    variant: 'High Deck CNG',
    fuelType: 'cng',
    seatingCapacity: 2,
    category: 'cargo',
    claimedMileage: 29.5,
    expectedMileage: 24.0,
    unit: 'km/kg',
    onRoadPriceINR: 660000,
    defaultDownPaymentINR: 100000,
    defaultTenureMonths: 36,
    defaultInterestRate: 11.5,
    estimatedEmiINR: 18400,
    adBlueRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80',
    description: 'Commercial mini freight cargo transporter for intracity logistics, last-mile delivery, and e-commerce distribution.',
  },
];
