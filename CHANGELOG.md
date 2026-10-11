# Changelog

All notable changes to the **FleetWise** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-11

### 🚀 Added (New Features)
- **Taxi Business Intelligence Engine**: Real-time month-to-date (MTD) revenue aggregation, operational cost analysis, net profit calculations, and operating margin percentages.
- **5-Year Multi-Vehicle Profit Simulator**:
  - Compounding EMI calculation engine with down payment, interest rates, and loan tenure options.
  - Multi-vehicle revenue modeling across Ola, Uber, Rapido, and Private leases.
  - Vehicle degradation curves for both battery EV capacity and combustion engines.
  - Interactive 36-month cumulative cash flow projections via Recharts.
- **Google Gemini Flash Free Tier AI Advisor**:
  - Automated fleet depth diagnostics analyzing revenue-to-km efficiency.
  - Contextual AI recommendations embedded directly in the Dashboard and Profit Simulator.
  - Automatic model fallback chain (`gemini-3.5-flash` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.5-flash-lite`).
- **Fleet & Vehicle Management**:
  - Full CRUD operations with support for EV, Petrol, Diesel, and CNG fuel variants.
  - Driver assignment tracking, odometer tracking, and service interval reminders.
- **Multi-Channel Journey & Trip Ledger**:
  - Trip logging with platform commission deductions and driver wage splits.
  - Multi-stop journey recording with start/end odometer verification.
- **Fuel & Operating Expense Tracker**:
  - Dual-ledger support for daily fuel/energy logs and periodic operational expenses (insurance, permits, tires).
- **In-App Version Checker & Update Manager**:
  - Live version check popup on both the web application and standalone Android APK.
  - Non-intrusive "What's New" mini toast notification on startup.
  - Direct standalone APK download link and detailed changelog inspection.

### 📱 Mobile & Standalone Android APK
- **Capacitor 6 Android Wrapper**: Direct packaging into an Android APK (`com.fleetwise.app`).
- **Offline-First Architecture**: Standalone APK capability using on-device IndexedDB / SQLite caching.
- **Device-Level Backup**: One-click local database JSON backup export directly from Settings.
- **Adaptive Mobile Layout**: Touch-optimized bottom navigation with quick access to Dashboard, Trips, Vehicles, and Fuel.

### ⚡ Performance & Engine Improvements
- **Sub-100ms Analytics Queries**: Optimized MongoDB aggregation pipelines with compound indexes on `businessId`, `date`, `status`, and `vehicleId`.
- **Decimal128 Currency Representation**: Exact financial arithmetic eliminating floating-point rounding errors.
- **Ultra-Fast Vite Frontend**: Sub-second Hot Module Replacement (HMR) and optimized vendor chunk splitting.

### 🐞 Fixes & Security
- **Strict PostCSS Tailwind Directives**: Configured `.vscode/settings.json` and custom CSS fallbacks for zero-warning builds.
- **Enterprise-Grade Authentication**: Argon2 password hashing, secure HTTP-only cookies, and refresh token rotation with account lockout protection.
- **MongoDB Injection Prevention**: Middleware sanitization blocking malicious query operators (`$gt`, `$ne`, etc.).
