/**
 * Server-only: fetch all logged-in user library data in one round-trip.
 * Uses Firebase Admin Firestore (namespace API: db.collection().where().get()).
 * Import only from API routes or getServerSideProps.
 *
 * Returns: { likedSongIds, playlists, savedPlaylists, savedArtists }
 * Same shape as client fetchLibraryData but without cover tab docs (client can batch those if needed).
 */

import { getAdminDb } from './admin-db';
import { FieldPath } from 'firebase-admin/firestore';

const BATCH_IN_LIMIT = 30;
const docId = FieldPath.documentId();

function safePlaylistTitle(title) {
  if (typeof title === 'string' && title.trim()) return title.trim();
  return '未命名歌單';
}

/**
 * Get all user library data with a single batch of parallel Firestore reads.
 * Does not fetch tab/artist/playlist document bodies for "covers" — only IDs and meta.
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{ likedSongIds: string[], playlists: Array, savedPlaylists: Array, savedArtists: Array }>}
 */
export async function getUserLibraryData(userId) {
  const db = getAdminDb();
  if (!db || !userId) {
    return { likedSongIds: [], playlists: [], savedPlaylists: [], savedArtists: [] };
  }

  const [
    likedSnap,
    userPlaylistsSnap,
    savedPlaylistsSnap,
    savedArtistsSnap,
  ] = await Promise.all([
    db.collection('userLikedSongs').where('userId', '==', userId).get(),
    db.collection('userPlaylists').where('userId', '==', userId).get(),
    db.collection('userSavedPlaylists').where('userId', '==', userId).get(),
    db.collection('userSavedArtists').where('userId', '==', userId).get(),
  ]);

  const likedSongIds = likedSnap.docs.map((d) => d.data().songId).filter(Boolean);

  const userPlaylists = userPlaylistsSnap.docs
    .map((d) => {
      const data = d.data();
      return { id: d.id, ...data, title: safePlaylistTitle(data.title) };
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

  // 一次過喺 server 攞齊歌單封面用嘅 tab（免 client 再 call getTabsByIds，加快收藏頁載入）
  const tabIdsForCovers = [];
  const seenTabId = new Set();
  for (const pl of userPlaylists) {
    const ids = (pl.songIds || []).slice(0, 4);
    for (const id of ids) {
      if (id && !seenTabId.has(id)) {
        seenTabId.add(id);
        tabIdsForCovers.push(id);
      }
    }
  }
  const tabMap = new Map();
  if (tabIdsForCovers.length > 0) {
    const TAB_BATCH = 10;
    for (let i = 0; i < tabIdsForCovers.length; i += TAB_BATCH) {
      const chunk = tabIdsForCovers.slice(i, i + TAB_BATCH);
      const tabSnap = await db.collection('tabs').where(docId, 'in', chunk).get();
      tabSnap.docs.forEach((d) => {
        const data = d.data();
        tabMap.set(d.id, {
          id: d.id,
          thumbnail: data.thumbnail ?? null,
          albumImage: data.albumImage ?? null,
          youtubeVideoId: data.youtubeVideoId ?? null,
          youtubeUrl: data.youtubeUrl ?? null,
          artistPhoto: data.artistPhoto ?? null,
          coverImage: data.coverImage ?? null,
        });
      });
    }
  }
  const playlistsWithCovers = userPlaylists.map((pl) => {
    const ids = (pl.songIds || []).slice(0, 4);
    const coverSongs = ids.map((id) => tabMap.get(id)).filter(Boolean);
    return { ...pl, coverSongs };
  });

  const savedPlaylistIds = savedPlaylistsSnap.docs.map((d) => d.data().playlistId);
  const savedPlaylistSavedAt = new Map(
    savedPlaylistsSnap.docs.map((d) => {
      const { playlistId, savedAt } = d.data();
      return [playlistId, savedAt?.toMillis?.() ?? 0];
    })
  );

  const savedArtistIds = savedArtistsSnap.docs.map((d) => d.data().artistId);
  const savedArtistSavedAt = new Map(
    savedArtistsSnap.docs.map((d) => {
      const { artistId, savedAt } = d.data();
      return [artistId, savedAt?.toMillis?.() ?? 0];
    })
  );

  let savedPlaylists = [];
  if (savedPlaylistIds.length > 0) {
    const playlistById = new Map();
    for (let i = 0; i < savedPlaylistIds.length; i += BATCH_IN_LIMIT) {
      const chunk = savedPlaylistIds.slice(i, i + BATCH_IN_LIMIT);
      const batchSnap = await db.collection('playlists').where(docId, 'in', chunk).get();
      batchSnap.docs.forEach((d) => playlistById.set(d.id, { id: d.id, ...d.data() }));
    }
    savedPlaylists = savedPlaylistIds
      .map((id) => {
        const meta = playlistById.get(id);
        if (!meta) return null;
        return { ...meta, title: safePlaylistTitle(meta.title), savedAtMs: savedPlaylistSavedAt.get(id) ?? 0 };
      })
      .filter(Boolean);
  }

  let savedArtists = [];
  if (savedArtistIds.length > 0) {
    const artistById = new Map();
    for (let i = 0; i < savedArtistIds.length; i += BATCH_IN_LIMIT) {
      const chunk = savedArtistIds.slice(i, i + BATCH_IN_LIMIT);
      const batchSnap = await db.collection('artists').where(docId, 'in', chunk).get();
      batchSnap.docs.forEach((d) => artistById.set(d.id, { id: d.id, ...d.data() }));
    }
    savedArtists = savedArtistIds
      .map((id) => {
        const meta = artistById.get(id);
        if (!meta) return null;
        return { ...meta, savedAtMs: savedArtistSavedAt.get(id) ?? 0 };
      })
      .filter(Boolean);
  }

  return {
    likedSongIds,
    playlists: playlistsWithCovers,
    savedPlaylists,
    savedArtists,
  };
}
