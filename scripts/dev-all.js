#!/usr/bin/env node
import os from 'os';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Find all IPv4 network addresses
const interfaces = os.networkInterfaces();
const addresses = [];

for (const name of Object.keys(interfaces)) {
  for (const net of interfaces[name] || []) {
    if (net.family === 'IPv4' && !net.internal) {
      addresses.push({ name, address: net.address });
    }
  }
}

// Prefer Wi-Fi or 192.168 / 10.x
const wifi = addresses.find((a) => /wi-fi|wlan|wireless/i.test(a.name)) || addresses[0];

console.log('\n================================================================');
console.log('🚀 FleetWise Local Development Environment & Network Access');
console.log('================================================================');
console.log('💻 Localhost Access (PC Browser):');
console.log('   ➜ Web App:        http://localhost:5173');
console.log('   ➜ Backend API:    http://localhost:5000/api/v1');
console.log('   ➜ Health Check:   http://localhost:5000/health');
console.log('----------------------------------------------------------------');
console.log('📱 Mobile / Wi-Fi Network Access (Test from Mobile Phone):');

if (addresses.length > 0) {
  addresses.forEach(({ name, address }) => {
    console.log(`   ➜ ${name.padEnd(14)}: http://${address}:5173  (API: http://${address}:5000/api/v1)`);
  });
  if (wifi) {
    console.log(`\n💡 Best Mobile URL to open in Chrome on your phone:`);
    console.log(`   👉 http://${wifi.address}:5173`);
  }
} else {
  console.log('   ➜ http://localhost:5173');
}

console.log('----------------------------------------------------------------');
console.log('📶 Wireless ADB Android Testing:');
console.log('   Run: npm run adb:wireless  (to pair or connect phone over Wi-Fi)');
console.log('   Run: npm run adb:install   (to install APK directly over Wi-Fi)');
console.log('================================================================\n');

// Start backend and frontend concurrently
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const devProcess = spawn(
  npxCmd,
  [
    'concurrently',
    '-c', 'cyan,magenta',
    '-n', 'SERVER,CLIENT',
    '"npm run dev --workspace=server"',
    '"npm run dev --workspace=client -- --host 0.0.0.0"',
  ],
  {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  }
);

devProcess.on('exit', (code) => {
  process.exit(code || 0);
});
