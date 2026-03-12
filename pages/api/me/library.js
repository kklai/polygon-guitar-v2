/**
 * GET /api/me/library
 *
 * Returns all logged-in user library data in one response:
 * - likedSongIds
 * - playlists (user-created playlists)
 * - savedPlaylists (site playlists the user saved)
 * - savedArtists
 *
 * Auth: Authorization: Bearer <Firebase ID token>
 * Client gets token via: auth.currentUser.getIdToken()
 */

import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/admin-db';
import { getUserLibraryData } from '@/lib/userLibraryApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: send Authorization: Bearer <idToken>' });
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing token' });
  }

  // Ensure Admin app is initialized (needed for getAuth)
  const db = getAdminDb();
  if (!db) {
    return res.status(503).json({ error: 'Server config: Firebase Admin not available' });
  }

  let uid;
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (e) {
    console.error('[api/me/library] verifyIdToken failed', e?.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    const data = await getUserLibraryData(uid);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    return res.status(200).json(data);
  } catch (e) {
    console.error('[api/me/library]', e?.message);
    return res.status(500).json({ error: 'Failed to load library', detail: e?.message });
  }
}
