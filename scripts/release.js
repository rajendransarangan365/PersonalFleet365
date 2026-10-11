#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Args: npm run release [patch|minor|major] [optional-release-notes]
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch';
const customNotes = args[1] || 'Performance updates, latest fleet enhancements and standalone APK build';

function run(cmd, desc) {
  console.log(`\n🔹 ${desc}...`);
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Failed: ${desc}`);
    process.exit(1);
  }
}

console.log('=====================================================');
console.log('🚀 FleetWise Automated Production Release & APK Pipeline');
console.log('=====================================================');

// 1. Run test build across all packages first
run('npm run build', 'Verifying build and TypeScript compilation across all packages');

// 2. Read and bump version
const rootPkgPath = join(rootDir, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const [major, minor, patch] = rootPkg.version.split('.').map(Number);

let newVersion;
if (bumpType === 'major') newVersion = `${major + 1}.0.0`;
else if (bumpType === 'minor') newVersion = `${major}.${minor + 1}.0`;
else if (bumpType === 'patch') newVersion = `${major}.${minor}.${patch + 1}`;
else if (/^\d+\.\d+\.\d+$/.test(bumpType)) newVersion = bumpType;
else newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`\n📦 Bumping Version: v${rootPkg.version} ➔ v${newVersion}`);

// 3. Update all package.json files
rootPkg.version = newVersion;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');

const clientPkgPath = join(rootDir, 'client/package.json');
const clientPkg = JSON.parse(readFileSync(clientPkgPath, 'utf8'));
clientPkg.version = newVersion;
writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n');

const serverPkgPath = join(rootDir, 'server/package.json');
const serverPkg = JSON.parse(readFileSync(serverPkgPath, 'utf8'));
serverPkg.version = newVersion;
writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n');

// 4. Update client and server version.json
const today = new Date().toISOString().split('T')[0];
const updateVersionJson = (filePath) => {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    data.version = newVersion;
    data.latestVersion = newVersion;
    data.releaseDate = today;
    data.buildNumber = (data.buildNumber || 100) + 1;
    data.apkDownloadUrl = 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases/latest/download/app-debug.apk';
    data.githubReleaseUrl = 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases';
    data.changelog = data.changelog || [];
    
    if (!data.changelog.some((c) => c.version === newVersion)) {
      data.changelog.unshift({
        version: newVersion,
        date: today,
        title: `FleetWise v${newVersion} Release`,
        isCurrent: true,
        highlights: customNotes,
        categories: {
          features: [customNotes],
          mobile: ['Standalone Android APK compiled and available in Releases'],
          improvements: ['Continuous stability & optimization updates'],
          fixes: ['Routine maintenance & security dependency updates'],
        },
      });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ Updated ${filePath}`);
  } catch (err) {
    console.warn(`Warning updating ${filePath}:`, err.message);
  }
};

updateVersionJson(join(rootDir, 'client/public/version.json'));
updateVersionJson(join(rootDir, 'server/src/version.json'));

// 5. Update client/src/services/version.service.ts
const versionServicePath = join(rootDir, 'client/src/services/version.service.ts');
try {
  let content = readFileSync(versionServicePath, 'utf8');
  content = content.replace(/export const CURRENT_CLIENT_VERSION = '[^']+';/, `export const CURRENT_CLIENT_VERSION = '${newVersion}';`);
  writeFileSync(versionServicePath, content);
  console.log(`✓ Updated CURRENT_CLIENT_VERSION in client/src/services/version.service.ts`);
} catch (err) {
  console.warn('Warning updating version.service.ts:', err.message);
}

// 6. Update CHANGELOG.md
const changelogPath = join(rootDir, 'CHANGELOG.md');
try {
  let changelog = readFileSync(changelogPath, 'utf8');
  const newEntry = `
## [${newVersion}] - ${today}

### 🚀 Added / Changed
- ${customNotes}
- Standalone Android APK build refreshed for release.
`;
  changelog = changelog.replace('# Changelog\n', `# Changelog\n${newEntry}\n`);
  writeFileSync(changelogPath, changelog);
  console.log(`✓ Updated CHANGELOG.md`);
} catch (err) {
  console.warn('Warning updating CHANGELOG.md:', err.message);
}

// 7. Git commit, tag, and push
run('git add .', 'Staging release files');
run(`git commit -m "chore(release): v${newVersion} - ${customNotes}"`, `Committing release v${newVersion}`);
run(`git tag v${newVersion}`, `Creating git tag v${newVersion}`);

// Push to origin (main codebase repo for Render / Vercel)
run('git push origin main', 'Pushing source code to PersonalFleet365 (origin main)');

// Push tags to origin and release repo
run('git push origin --tags', 'Pushing release tags to PersonalFleet365');

try {
  run('git push release main --tags', 'Pushing release tags to PersonalFleet365-release for automated APK build');
} catch (err) {
  console.warn('Note: Could not push to release remote yet. Make sure release remote is added.');
}

console.log('\n=====================================================');
console.log(`🎉 FleetWise v${newVersion} Released Successfully!`);
console.log('Source repo:   https://github.com/rajendransarangan365/PersonalFleet365');
console.log('Release repo:  https://github.com/rajendransarangan365/PersonalFleet365-release');
console.log('=====================================================\n');
