import { Router, Request, Response } from 'express';
import versionData from '../../version.json';

const router = Router();

/**
 * GET /api/v1/app/version
 * Public endpoint returning current application version, changelog, and APK download links.
 */
router.get('/version', (req: Request, res: Response) => {
  const clientVersion = req.query.clientVersion as string | undefined;
  const currentServerVersion = (versionData.version as string) || '1.0.0';

  let hasUpdate = false;
  if (clientVersion && clientVersion !== currentServerVersion) {
    // Simple semver check
    const [cMajor = 0, cMinor = 0, cPatch = 0] = clientVersion.split('.').map(Number);
    const [sMajor = 0, sMinor = 0, sPatch = 0] = currentServerVersion.split('.').map(Number);

    if (
      sMajor > cMajor ||
      (sMajor === cMajor && sMinor > cMinor) ||
      (sMajor === cMajor && sMinor === cMinor && sPatch > cPatch)
    ) {
      hasUpdate = true;
    }
  }

  res.json({
    ...versionData,
    clientReportedVersion: clientVersion ?? null,
    hasUpdate,
    serverTimestamp: new Date().toISOString(),
  });
});

export default router;
