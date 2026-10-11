#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Args: npm run release [patch|minor|major] [optional-release-notes]
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch';
const customNotes = args[1] || 'Performance updates, latest fleet enhancements, and standalone Android APK';

function run(cmd, desc, ignoreError = false) {
  console.log(`\n🔹 ${desc}...`);
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    return true;
  } catch (error) {
    if (ignoreError) {
      console.warn(`⚠️ Warning: ${desc} skipped or failed.`);
      return false;
    }
    console.error(`❌ Failed: ${desc}`);
    process.exit(1);
  }
}

// Function to find GitHub Token from ENV, CLI, or .env files
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();

  // Try parsing from root .env or server/.env
  const envPaths = [join(rootDir, '.env'), join(rootDir, 'server/.env')];
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const lines = readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*(?:GITHUB_TOKEN|GH_TOKEN)\s*=\s*(.+)\s*$/);
          if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

console.log('================================================================');
console.log('🚀 Fleet365 Automated Production Release & APK GitHub Pipeline');
console.log('================================================================');

// 1. Run build verification across all packages
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
        title: `Fleet365 v${newVersion} Release`,
        isCurrent: true,
        highlights: customNotes,
        categories: {
          features: [customNotes],
          mobile: ['Standalone Android APK compiled and attached to GitHub Release'],
          improvements: ['PWA Web App install support & modern Fleet365 brand styling'],
          fixes: ['Continuous stability & security updates'],
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
- Standalone Android APK build compiled and uploaded to GitHub Releases.
- Modern Fleet365 PWA installation support.
`;
  changelog = changelog.replace('# Changelog\n', `# Changelog\n${newEntry}\n`);
  writeFileSync(changelogPath, changelog);
  console.log(`✓ Updated CHANGELOG.md`);
} catch (err) {
  console.warn('Warning updating CHANGELOG.md:', err.message);
}

// 7. Sync web build to Capacitor and compile Android APK
console.log('\n📲 Building Standalone Android APK...');
run('npx cap sync android', 'Syncing web assets into Capacitor Android', true);

const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug';
try {
  execSync(gradlewCmd, { cwd: join(rootDir, 'android'), stdio: 'inherit' });
  console.log('✅ Android APK compiled successfully!');
} catch (err) {
  console.warn('⚠️ Gradle compilation failed or skipped. Continuing with Git release.');
}

// Check if APK exists
const apkPath = join(rootDir, 'android/app/build/outputs/apk/debug/app-debug.apk');
const apkExists = existsSync(apkPath);
if (apkExists) {
  const stats = readFileSync(apkPath);
  console.log(`📱 Located APK: ${apkPath} (${(stats.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// 8. Git commit, tag, and push to remotes
run('git add .', 'Staging release files');
run(`git commit -m "chore(release): v${newVersion} - ${customNotes}"`, `Committing release v${newVersion}`);
run(`git tag -a v${newVersion} -m "Release v${newVersion}"`, `Creating git tag v${newVersion}`, true);

// Push to origin (main codebase repo for Render & Vercel)
run('git push origin main', 'Pushing source code to PersonalFleet365 (origin main)');
run('git push origin --tags', 'Pushing release tags to PersonalFleet365');

// Push to release repo
try {
  run('git push release main --tags', 'Pushing release tags to PersonalFleet365-release');
} catch (err) {
  console.warn('Note: Could not push to release remote. Ensure remote is configured.');
}

// 9. GitHub REST API Automated Release & APK Asset Upload
async function publishGitHubRelease() {
  const token = getGitHubToken();
  const repoOwner = 'rajendransarangan365';
  const releaseRepo = 'PersonalFleet365-release';

  if (!token) {
    console.log('\n----------------------------------------------------------------');
    console.log('ℹ️  AUTOMATIC GITHUB API RELEASE SKIPPED (No Token Found)');
    console.log('To automatically create GitHub Releases & upload app-debug.apk:');
    console.log('1. Copy one of your Personal Access Tokens (Classic) from GitHub Settings.');
    console.log('2. Add to your root .env:');
    console.log('   GITHUB_TOKEN=ghp_yourPersonalAccessTokenHere');
    console.log('   Or run in terminal:');
    console.log('   $env:GITHUB_TOKEN="ghp_..."; npm run release');
    console.log('----------------------------------------------------------------');
    return;
  }

  console.log(`\n🌐 Creating GitHub Release v${newVersion} via GitHub REST API...`);
  try {
    const releasePayload = {
      tag_name: `v${newVersion}`,
      target_commitish: 'main',
      name: `Fleet365 v${newVersion} Production Release`,
      body: `## 🚀 Fleet365 v${newVersion}\n\n${customNotes}\n\n### 📦 Release Artifacts:\n- **Standalone Android APK**: \`app-debug.apk\` (Compiled and ready to install on Android devices)\n\n### 🌐 Architecture & Live URLs:\n- **Frontend**: Deployed on Vercel\n- **Backend**: Deployed on Render\n- **Database**: MongoDB Atlas\n- **Free Cloudinary Media**: Verified 25 GB Quota\n- **Free OpenStreetMap Navigation**: Leaflet GPS Engine (Zero API costs)`,
      draft: false,
      prerelease: false,
    };

    const res = await fetch(`https://api.github.com/repos/${repoOwner}/${releaseRepo}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'FleetWise-Release-CLI',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(releasePayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`⚠️ GitHub Release creation responded with HTTP ${res.status}: ${errorText}`);
      return;
    }

    const releaseData = await res.json();
    console.log(`🎉 GitHub Release created successfully: ${releaseData.html_url}`);

    // Upload the APK asset if available
    if (apkExists) {
      console.log(`⬆️ Uploading app-debug.apk asset via GitHub Upload API...`);
      const apkBuffer = readFileSync(apkPath);
      const uploadUrl = `https://uploads.github.com/repos/${repoOwner}/${releaseRepo}/releases/${releaseData.id}/assets?name=app-debug.apk`;

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'FleetWise-Release-CLI',
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(apkBuffer.length),
        },
        body: apkBuffer,
      });

      if (uploadRes.ok) {
        const assetData = await uploadRes.json();
        console.log(`✅ Asset app-debug.apk uploaded successfully!`);
        console.log(`📥 Download URL: ${assetData.browser_download_url}`);
      } else {
        const uploadErr = await uploadRes.text();
        console.warn(`⚠️ Asset upload responded with ${uploadRes.status}: ${uploadErr}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed calling GitHub API:', err.message);
  }
}

// Run GitHub Release
publishGitHubRelease().then(() => {
  console.log('\n================================================================');
  console.log(`🎉 Fleet365 v${newVersion} Pipeline Complete!`);
  console.log('Source Code Repo:   https://github.com/rajendransarangan365/PersonalFleet365');
  console.log('Release & APK Repo: https://github.com/rajendransarangan365/PersonalFleet365-release');
  console.log('================================================================\n');
});
