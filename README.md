# 🚖 FleetWise — Fleet Management & Business Intelligence Platform

FleetWise is a production-grade Fleet Management, Taxi Business Intelligence & Profit Simulator platform built with:
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Node.js, Express.js, TypeScript, Mongoose, Argon2, Zod
- **Database**: MongoDB Atlas
- **AI Intelligence**: Google Gemini Flash (Free Tier) for fleet diagnostics & scenario recommendations
- **Mobile**: Capacitor 6 (Cross-platform Standalone Android APK with offline storage)

---

## 📋 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Environment Configuration](#-environment-configuration)
3. [Running Frontend & Backend Locally](#-running-frontend--backend-locally)
4. [How to Generate Standalone Android APK](#-how-to-generate-standalone-android-apk)
5. [Automated APK Generation via GitHub Actions](#-automated-apk-generation-via-github-actions)
6. [Cloud Deployment (Render + Vercel)](#-cloud-deployment-render--vercel)
7. [Project Structure](#-project-structure)

---

## 🛠 Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher
- **Git**
- **For Android APK Generation (Local)**:
  - Java Development Kit (JDK 17+)
  - Android Studio & Android SDK (API Level 34+)

---

## ⚙ Environment Configuration

### Backend Setup (`server/.env`)
Create or edit `server/.env`:

```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection
MONGO_URI=mongodb+srv://<db_user>:<db_password>@fleet365.jkjxj7t.mongodb.net/fleetwise?retryWrites=true&w=majority&appName=Fleet365

# Security Secrets
JWT_SECRET=your_jwt_access_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
CORS_ORIGIN=http://localhost:5173

# Google Gemini Free Tier API Key (configured in server/.env)
GEMINI_API_KEY=your_google_gemini_api_key
```

### Frontend Setup (`client/.env`)
Create `client/.env` (optional, defaults to `http://localhost:5000/api/v1`):

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 🚀 Running Frontend & Backend Locally

### Option 1: Run Both Concurrently (Recommended)
From the root workspace directory (`e:\fleet`):

```bash
# 1. Install all dependencies across all packages
npm install

# 2. Start both backend (port 5000) and frontend (port 5173) together
npm run dev
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option 2: Run Separately in Individual Terminals

#### Terminal 1 — Backend:
```bash
cd server
npm run dev
```

#### Terminal 2 — Frontend:
```bash
cd client
npm run dev
```

---

### Verifying Build & Tests
To build all packages for production:
```bash
npm run build
```
This builds:
1. `@fleetwise/shared` (TypeScript types and validation schemas)
2. `@fleetwise/server` (Node.js API bundle)
3. `@fleetwise/client` (Vite production bundle into `client/dist`)

---

## 📱 How to Generate Standalone Android APK

FleetWise uses **Capacitor 6** to compile the React application into a standalone Android APK.

### Step 1: Ensure Capacitor Android package is installed
In the root directory:
```bash
npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android
```

### Step 2: Build the Frontend Production Assets
```bash
# Build shared library & client
npm run build --workspace=shared
npm run build --workspace=client
```
*(This outputs the optimized web app into `client/dist`)*.

### Step 3: Add and Sync the Android Platform
```bash
# Run once to initialize the android project folder:
npx cap add android

# Sync your web build (client/dist) with the native Android project:
npx cap sync android
```

### Step 4: Build the APK using Gradle

#### On Windows (PowerShell / CMD):
```powershell
cd android
.\gradlew assembleDebug
```

#### On Linux / macOS:
```bash
cd android
./gradlew assembleDebug
```

### Step 5: Locate and Install the APK
Once Gradle finishes, the debug APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

#### Install on connected Android device / emulator via ADB:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
*Or simply copy `app-debug.apk` to your phone via USB or Google Drive and install it.*

---

## 🤖 Automated APK Generation via GitHub Actions

To automatically compile and generate an APK on GitHub without installing Android Studio locally:

1. Push your code to a GitHub repository.
2. Create `.github/workflows/build-apk.yml`:

```yaml
name: Build & Release Standalone Android APK

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Setup Java JDK
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install Dependencies
        run: npm ci

      - name: Build Web App
        run: |
          npm run build --workspace=shared
          npm run build --workspace=client

      - name: Sync Capacitor
        run: |
          npx cap add android || true
          npx cap sync android

      - name: Build Debug APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: FleetWise-Debug-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

Whenever you push a tag like `git tag v1.0.0 && git push origin v1.0.0`, GitHub Actions will compile and upload the `.apk` file under your repo's Actions / Releases tab.

---

## ☁ Cloud Deployment (Render + Vercel)

### Backend API (Free Tier on Render)
1. Push repository to GitHub.
2. On [Render.com](https://render.com), click **New +** $\rightarrow$ **Web Service**.
3. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `node dist/index.js`
4. Add Environment Variables:
   - `MONGO_URI`: `mongodb+srv://...`
   - `JWT_SECRET`: your secret
   - `GEMINI_API_KEY`: your Gemini API key
   - `CORS_ORIGIN`: your Vercel frontend URL

### Frontend App (Free Tier on Vercel)
1. On [Vercel.com](https://vercel.com), click **Add New** $\rightarrow$ **Project**.
2. Select your repository.
3. Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Environment Variables:
   - `VITE_API_URL`: `https://your-render-service.onrender.com/api/v1`

---

## 📂 Project Structure

```
fleet/
├── client/                     # Vite + React + TypeScript + Tailwind Frontend
│   ├── src/
│   │   ├── components/         # Glassmorphism Layout, Navbar, Modal, KPI Cards
│   │   ├── pages/              # Dashboard, Vehicles, Trips, Expenses, Simulator, Reports
│   │   ├── services/           # REST API client & Gemini AI direct integration
│   │   └── index.css           # Custom styling & Tailwind directives
│   └── vite.config.ts
├── server/                     # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── modules/            # Vehicles, Trips, Expenses, Drivers, Simulator, Analytics
│   │   ├── services/           # Gemini AI Free Tier service with fallback chain
│   │   ├── models/             # Mongoose schemas (Decimal128, indexes)
│   │   └── index.ts            # Express server initialization
│   └── .env                    # MongoDB URI & API Keys
├── shared/                     # Shared TypeScript types & validation schemas
├── capacitor.config.ts         # Android Capacitor configuration
├── ANDROID_STANDALONE_GUIDE.md # In-depth Android & offline SQLite sync notes
├── package.json                # Monorepo workspace configuration
└── README.md                   # This document
```
