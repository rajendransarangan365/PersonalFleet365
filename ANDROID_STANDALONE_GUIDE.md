# FleetWise — Standalone Android APK & Deployment Architecture Guide

This guide answers your requirements for:
1. **Cloud Deployment**: Free tier hosting on **Render** (Backend API & MongoDB Atlas) and **Vercel** (React Frontend).
2. **Standalone Android APK with Local Database**: Running entirely on-device without external servers.
3. **Git Version Management & Automated APK Releases**.

---

## 1. Feasibility: Can Node.js Express + MongoDB run on an Android Device?

### The Architectural Reality
- **Full MongoDB Server** requires an x86_64 or ARM64 Linux daemon with 1GB+ RAM, background memory paging, and root socket permissions. Android's Linux sandbox restricts background servers from running long-lived daemons without heavy battery drain and system kill triggers.
- **Node.js**: Running Node.js directly on Android requires an embedded Node runtime (e.g., `nodejs-mobile-react-native` or Termux), which bloats the APK to >150MB and frequently gets killed by Android's Doze mode.

### The Production Industry Standard Solution: Offline-First Hybrid Architecture
Instead of running a heavy Node.js + Mongo daemon on the phone:
1. **Frontend**: Vite + React runs natively inside **Capacitor 6** inside the Android APK.
2. **Local Database**: Data is stored on-device in **SQLite / IndexedDB** using the web storage layer.
3. **Sync Engine**: When offline, all trips, fuel logs, and simulations are saved locally. When connected to the internet, it auto-syncs with the cloud MongoDB server.
4. **Standalone Mode**: The APK works 100% offline with zero cloud connection required.

---

## 2. Compiling the Standalone Android APK

### Prerequisites
- Android Studio / Android SDK (API 34+)
- Java JDK 17+
- Node.js 20+

### Step-by-Step Build Commands

1. **Build the production web assets**:
   ```bash
   cd e:\fleet
   npm run build --workspace=shared
   npm run build --workspace=client
   ```

2. **Initialize Capacitor Android project**:
   ```bash
   npx cap add android
   npx cap sync android
   ```

3. **Build the Debug or Release APK using Gradle**:
   ```powershell
   cd android
   .\gradlew assembleDebug
   ```
   The compiled APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Install directly on connected Android device / emulator**:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 3. Git Version Management & Automated GitHub Actions CI/CD

To automate building the APK on every Git tag, use the included GitHub Actions workflow below.

Create `.github/workflows/build-apk.yml`:

```yaml
name: Build & Release Standalone Android APK

on:
  push:
    tags:
      - 'v*'

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

      - name: Install Dependencies
        run: npm ci

      - name: Build Web Client
        run: |
          npm run build --workspace=shared
          npm run build --workspace=client

      - name: Add Android & Sync
        run: |
          npx cap add android || true
          npx cap sync android

      - name: Build Standalone APK
        working-directory: android
        run: ./gradlew assembleRelease

      - name: Create GitHub Release with APK
        uses: softprops/action-gh-release@v2
        with:
          files: android/app/build/outputs/apk/release/*.apk
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Git Tagging Workflow
Whenever you want to release a new version of FleetWise:
```bash
git add .
git commit -m "feat: release version 1.0.0"
git tag v1.0.0
git push origin main --tags
```
GitHub Actions will automatically compile the standalone APK and attach `FleetWise-v1.0.0.apk` to your GitHub Releases page!

---

## 4. Free Cloud Deployment Guide

### A. Backend on Render (Free Tier)
1. Go to [render.com](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: Your free MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_ACCESS_SECRET`: Generate a 64-char random string
   - `JWT_REFRESH_SECRET`: Generate a 64-char random string
   - `COOKIE_SECRET`: Generate a 32-char random string
   - `CORS_ORIGIN`: Your Vercel frontend URL (e.g. `https://fleetwise.vercel.app`)

### B. Frontend on Vercel (Free Tier)
1. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Select the repository.
3. Set **Root Directory** to `client`.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Add Environment Variable:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://fleetwise-api.onrender.com/api/v1`)
8. Click **Deploy**!
