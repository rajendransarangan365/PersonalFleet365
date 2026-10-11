export interface ChangelogCategories {
  features: string[];
  mobile: string[];
  improvements: string[];
  fixes: string[];
}

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  isCurrent?: boolean;
  highlights?: string;
  categories: ChangelogCategories;
}

export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  minSupportedVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  apkDownloadUrl: string;
  githubReleaseUrl: string;
  changelog: ChangelogItem[];
  clientReportedVersion?: string | null;
  serverTimestamp?: string;
}

export const CURRENT_CLIENT_VERSION = '1.0.1';
export const CURRENT_BUILD_NUMBER = 100;
const STORAGE_KEY_LAST_SEEN_VERSION = 'fleetwise_last_seen_version';

/**
 * Check if the application is running in an Android/Capacitor environment
 */
export function isAndroidApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      navigator.userAgent.includes('wv') ||
      navigator.userAgent.includes('Android'))
  );
}

/**
 * Fetch version and changelog information from server or fallback to local version.json
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';

  // Attempt 1: Fetch from server API
  try {
    const res = await fetch(`${apiUrl}/app/version?clientVersion=${CURRENT_CLIENT_VERSION}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Server unreachable, fall back to bundled public version.json
  }

  // Attempt 2: Direct GitHub Releases API check (works for Standalone APK & Web)
  try {
    const ghRes = await fetch('https://api.github.com/repos/rajendransarangan365/PersonalFleet365-release/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const tagName = (ghData.tag_name as string)?.replace(/^v/, '') || CURRENT_CLIENT_VERSION;
      const isNewer = compareVersions(tagName, CURRENT_CLIENT_VERSION) > 0;
      const apkAsset = ghData.assets?.find((a: { name?: string; browser_download_url?: string }) => a.name?.endsWith('.apk'));
      
      let localData: Partial<VersionInfo> = {};
      try {
        const localRes = await fetch('/version.json');
        if (localRes.ok) localData = await localRes.json();
      } catch {
        // ignore
      }

      return {
        version: CURRENT_CLIENT_VERSION,
        buildNumber: CURRENT_BUILD_NUMBER,
        releaseDate: ghData.published_at?.split('T')[0] || '2026-10-11',
        minSupportedVersion: '1.0.0',
        latestVersion: tagName,
        hasUpdate: isNewer,
        apkDownloadUrl: apkAsset?.browser_download_url || 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases/latest/download/app-debug.apk',
        githubReleaseUrl: ghData.html_url || 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases',
        changelog: localData.changelog || [],
      };
    }
  } catch {
    // Fall back to local bundled version.json
  }

  // Attempt 3: Bundled local version.json (works 100% offline)
  try {
    const res = await fetch('/version.json');
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // If completely offline without fetch
  }

  // Fallback defaults
  return {
    version: CURRENT_CLIENT_VERSION,
    buildNumber: CURRENT_BUILD_NUMBER,
    releaseDate: '2026-10-11',
    minSupportedVersion: '1.0.0',
    latestVersion: CURRENT_CLIENT_VERSION,
    hasUpdate: false,
    apkDownloadUrl: 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases/latest/download/app-debug.apk',
    githubReleaseUrl: 'https://github.com/rajendransarangan365/PersonalFleet365-release/releases',
    changelog: [
      {
        version: CURRENT_CLIENT_VERSION,
        date: '2026-10-11',
        title: 'FleetWise 1.0 Production & Standalone APK Release',
        isCurrent: true,
        highlights: 'Complete Taxi Business Intelligence, Fleet Management, 5-Year Profit Simulator, Gemini AI Free Tier diagnostics, and Standalone Android APK support.',
        categories: {
          features: [
            'Real-time Taxi BI Dashboard with MTD revenue, profit margin, and fuel expenses',
            'Fleet Management CRUD with EV, Petrol, Diesel & CNG status',
            'Multi-channel trip ledger (Ola, Uber, Rapido, Private)',
            '5-Year Multi-Vehicle Profit Simulator with EMI and degradation curves',
            'Google Gemini Flash Free Tier AI Advisor for depth diagnostic reports'
          ],
          mobile: [
            'Standalone Android APK packaging via Capacitor 6',
            'Offline-first architecture with local SQLite/IndexedDB sync',
            'Device-level backup JSON export',
            'Mobile adaptive bottom navigation'
          ],
          improvements: [
            'MongoDB aggregation pipeline optimization for sub-100ms response times',
            'Decimal128 currency precision',
            'Glassmorphism dark theme'
          ],
          fixes: [
            'Fixed IDE @apply CSS linting warnings',
            'Secured JWT with Argon2 password hashing'
          ]
        }
      }
    ]
  };
}

/**
 * Compare two semver strings (returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal)
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Check if the user hasn't seen the changelog for the current version yet
 */
export function hasUnseenChangelog(currentVersion = CURRENT_CLIENT_VERSION): boolean {
  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY_LAST_SEEN_VERSION);
    return !lastSeen || compareVersions(currentVersion, lastSeen) > 0;
  } catch {
    return false;
  }
}

/**
 * Mark current version changelog as seen
 */
export function markChangelogSeen(version = CURRENT_CLIENT_VERSION): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SEEN_VERSION, version);
  } catch {
    // Ignore storage errors
  }
}
