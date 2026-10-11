#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get bump argument (patch | minor | major | <x.y.z>)
const arg = process.argv[2] || 'patch';

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      console.error(`Invalid version or bump type: ${type}. Use 'patch', 'minor', 'major', or '1.2.3'`);
      process.exit(1);
  }
}

// 1. Read root package.json
const rootPkgPath = join(rootDir, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const oldVersion = rootPkg.version;
const newVersion = bumpVersion(oldVersion, arg);

console.log(`\n📦 Bumping FleetWise version: v${oldVersion} -> v${newVersion}\n`);

// 2. Update root package.json
rootPkg.version = newVersion;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
console.log(`✓ Updated root package.json`);

// 3. Update client/package.json
const clientPkgPath = join(rootDir, 'client/package.json');
try {
  const clientPkg = JSON.parse(readFileSync(clientPkgPath, 'utf8'));
  clientPkg.version = newVersion;
  writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n');
  console.log(`✓ Updated client/package.json`);
} catch (e) {
  console.warn(`Could not update client/package.json`, e.message);
}

// 4. Update server/package.json
const serverPkgPath = join(rootDir, 'server/package.json');
try {
  const serverPkg = JSON.parse(readFileSync(serverPkgPath, 'utf8'));
  serverPkg.version = newVersion;
  writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n');
  console.log(`✓ Updated server/package.json`);
} catch (e) {
  console.warn(`Could not update server/package.json`, e.message);
}

// 5. Update client/public/version.json
const today = new Date().toISOString().split('T')[0];
const updateVersionJson = (path) => {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.version = newVersion;
    data.latestVersion = newVersion;
    data.releaseDate = today;
    data.buildNumber = (data.buildNumber || 100) + 1;
    
    // Check if new version already exists in changelog
    if (!data.changelog.some((c) => c.version === newVersion)) {
      data.changelog.unshift({
        version: newVersion,
        date: today,
        title: `FleetWise v${newVersion} Maintenance & Feature Update`,
        isCurrent: true,
        highlights: `Automated release v${newVersion} with latest performance improvements and bug fixes.`,
        categories: {
          features: [],
          mobile: [],
          improvements: [`General stability and performance optimizations across web and APK builds`],
          fixes: [`Routine security and dependency updates`],
        },
      });
    }
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ Updated ${path}`);
  } catch (e) {
    console.warn(`Failed to update ${path}:`, e.message);
  }
};

updateVersionJson(join(rootDir, 'client/public/version.json'));
updateVersionJson(join(rootDir, 'server/src/version.json'));

// 6. Update CURRENT_CLIENT_VERSION in client/src/services/version.service.ts
const versionServicePath = join(rootDir, 'client/src/services/version.service.ts');
try {
  let content = readFileSync(versionServicePath, 'utf8');
  content = content.replace(/export const CURRENT_CLIENT_VERSION = '[^']+';/, `export const CURRENT_CLIENT_VERSION = '${newVersion}';`);
  writeFileSync(versionServicePath, content);
  console.log(`✓ Updated CURRENT_CLIENT_VERSION in client/src/services/version.service.ts`);
} catch (e) {
  console.warn(`Failed to update version.service.ts:`, e.message);
}

console.log(`
🎉 Version successfully bumped to v${newVersion}!

Next Steps:
1. Review/edit CHANGELOG.md and client/public/version.json with specific release notes.
2. Commit and push:
   git add .
   git commit -m "chore(release): bump version to v${newVersion}"
   git tag v${newVersion}
   git push origin main --tags

3. GitHub Actions will automatically compile the Standalone Android APK and publish the release!
`);
