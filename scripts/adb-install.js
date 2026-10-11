#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getAdbPath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const standardSdkAdb = path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  if (fs.existsSync(standardSdkAdb)) {
    return standardSdkAdb;
  }
  return 'adb';
}

const adb = getAdbPath();
const rootDir = path.resolve();
const apkPath = path.join(rootDir, 'android/app/build/outputs/apk/debug/app-debug.apk');

console.log('\n================================================================');
console.log('📲 FleetWise Wireless APK Installer');
console.log('================================================================\n');

try {
  const devices = execSync(`"${adb}" devices`, { encoding: 'utf8' });
  console.log('Connected Devices:\n' + devices);

  const lines = devices.trim().split('\n').slice(1).filter((l) => l.includes('device') && !l.includes('offline'));
  if (lines.length === 0) {
    console.error('❌ No active Android devices found!');
    console.log('👉 First connect your phone by running: npm run adb:wireless\n');
    process.exit(1);
  }

  // Check if APK exists
  if (!fs.existsSync(apkPath)) {
    console.log('⚠️  Debug APK not found at android/app/build/outputs/apk/debug/app-debug.apk');
    console.log('Building APK using Gradle...\n');
    execSync('cd android && .\\gradlew assembleDebug', { stdio: 'inherit' });
  }

  console.log(`\n🚀 Installing FleetWise APK onto connected Android device...`);
  execSync(`"${adb}" install -r -d "${apkPath}"`, { stdio: 'inherit' });

  console.log('\n🎉 Installed successfully! Launching FleetWise on phone...');
  try {
    execSync(`"${adb}" shell monkey -p com.fleetwise.app -c android.intent.category.LAUNCHER 1`, { stdio: 'ignore' });
  } catch {
    // ignore
  }

  console.log('✅ App is now running on your phone!\n');
  console.log('💡 Tip: To inspect logs or debug live from Chrome on your PC:');
  console.log('   Open in PC Chrome: chrome://inspect/#devices\n');
} catch (err) {
  console.error('❌ Installation failed:', err.message);
  process.exit(1);
}
