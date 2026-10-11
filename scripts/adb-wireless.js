#!/usr/bin/env node
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function getAdbPath() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const standardSdkAdb = path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  if (fs.existsSync(standardSdkAdb)) {
    return standardSdkAdb;
  }
  return 'adb';
}

const adb = getAdbPath();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n================================================================');
  console.log('📶 FleetWise Android Wireless ADB Debugging Assistant');
  console.log('================================================================');
  console.log(`Using ADB: ${adb}\n`);

  console.log('Ensure your phone and this PC are connected to the SAME Wi-Fi network.');
  console.log('On your Android phone:');
  console.log('  1. Go to Settings ➔ Developer Options.');
  console.log('  2. Enable "Wireless Debugging" (toggle ON).');
  console.log('  3. Tap on "Wireless Debugging" to view your Phone IP & Port.\n');

  console.log('Choose connection method:');
  console.log('  [1] Android 11+ Pairing Code (Recommended - no USB needed)');
  console.log('  [2] Direct Connect (Already paired or using standard port 5555)');
  console.log('  [3] One-time USB Switch (Plug USB once, enables Wi-Fi adb)');
  console.log('  [4] List currently connected devices\n');

  const choice = (await question('Select option [1-4] (default: 1): ')).trim() || '1';

  if (choice === '1') {
    console.log('\nOn phone: Tap "Pair device with pairing code".');
    console.log('You will see:');
    console.log('  - Wi-Fi pairing code (e.g. 123456)');
    console.log('  - IP address & Port (e.g. 192.168.1.50:37891)\n');

    const ipPort = (await question('Enter Phone IP & Pairing Port (e.g. 192.168.1.50:37891): ')).trim();
    const code = (await question('Enter 6-digit Wi-Fi Pairing Code: ')).trim();

    if (ipPort && code) {
      console.log(`\n🔹 Pairing with ${ipPort}...`);
      try {
        const res = execSync(`"${adb}" pair ${ipPort} ${code}`, { encoding: 'utf8' });
        console.log(res);

        const connectPort = (await question('\nEnter the Wireless Debugging main IP:Port (shown on main Wireless Debugging screen): ')).trim();
        if (connectPort) {
          console.log(`\n🔹 Connecting to ${connectPort}...`);
          const connRes = execSync(`"${adb}" connect ${connectPort}`, { encoding: 'utf8' });
          console.log(connRes);
        }
      } catch (err) {
        console.error('❌ Pairing failed:', err.message);
      }
    }
  } else if (choice === '2') {
    const ipPort = (await question('\nEnter Phone IP & Port (e.g. 192.168.1.50:5555 or 192.168.1.50:41235): ')).trim();
    if (ipPort) {
      console.log(`\n🔹 Connecting to ${ipPort}...`);
      try {
        const res = execSync(`"${adb}" connect ${ipPort}`, { encoding: 'utf8' });
        console.log(res);
      } catch (err) {
        console.error('❌ Connection failed:', err.message);
      }
    }
  } else if (choice === '3') {
    console.log('\nEnsure phone is connected via USB cable with USB Debugging enabled.');
    try {
      console.log('🔹 Enabling wireless port 5555 on device...');
      execSync(`"${adb}" tcpip 5555`, { stdio: 'inherit' });
      const phoneIp = (await question('\nEnter your Phone Wi-Fi IP address (Settings ➔ Wi-Fi ➔ tap connected network): ')).trim();
      if (phoneIp) {
        console.log(`🔹 Connecting wirelessly to ${phoneIp}:5555...`);
        execSync(`"${adb}" connect ${phoneIp}:5555`, { stdio: 'inherit' });
        console.log('\n🎉 Connected! You can now UNPLUG the USB cable!');
      }
    } catch (err) {
      console.error('❌ USB mode switch failed:', err.message);
    }
  }

  // Display attached devices
  console.log('\n📱 Connected ADB Devices:');
  try {
    const devices = execSync(`"${adb}" devices -l`, { encoding: 'utf8' });
    console.log(devices);
  } catch (err) {
    console.error(err.message);
  }

  rl.close();
}

main().catch(console.error);
