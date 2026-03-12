# Firebase Firestore Requests — Round Summary

**Purpose:** Single reference for every Firestore read path in the app, with focus on **full collection reads** (entire `tabs` or `artists`) and how to reduce them.

**Rule of thumb:** 1 document returned = 1 read. A query with no `limit()` that matches 3000 tabs = 3000 reads.

---

## 1. Full collection reads (entire tabs or artists)

These are the hottest spots for cost. Ordered by impact: user-facing first, then cache builds, then admin.

TSV: [firebase-full-collection-reads.tsv](./firebase-full-collection-reads.tsv)

| Where | What | Reads | When | Mitigation |
|-------|------|-------|------|------------|
| **Artist page** `artists/[id].js` | `getTabsByArtist()` | **Up to 6 × (all matching tabs)** | Every artist visit | Add `limit(50–100)` + "Load more" / pagination |
| **lib/searchData.js** | `buildSearchDataPayload()` | **~3.2k tabs + ~500 artists** | Search-data **cold only** (cache miss or admin rebuild) | Already cached 24h; cold is rare |
| **lib/playlists.js** | `generateAutoPlaylist(type)` without preload | **All tabs** | When called without `songsPreloaded` | Always call via `refreshAllAutoPlaylists()` which passes preloaded songs |
| **lib/playlists.js** | `refreshAllAutoPlaylists()` | **All tabs** (once) | Cron or manual refresh | Acceptable; run infrequently |
| **lib/playlists.js** | `getAllActivePlaylists()` | **All playlists** | Home cold, playlist-page cold | 5-min in-memory cache; playlist count is small |
| **lib/tabs.js** | `getAllTabs()` | **1** when cache fresh; **all tabs** on cold | Admin pages (see below) | 24h Firestore cache `cache/allTabs`; cold = rebuild then 1 write |
| **lib/tabs.js** | `getAllTabs({ withContent: true })` | **All tabs (full docs)** | data-review, analyze-tabs API | No cache; admin-only. Consider sampling or background job. |
| **lib/tabs.js** | `getAllArtists()` | **All artists** | Admin + home cold (buildHomeDataPayload) | 5-min in-memory cache only; no Firestore cache |
| **ArtistInputSimple.jsx** | `getDocs(collection(db, 'artists'))` | **All artists** | Fallback when prefix search returns &lt;5 and user typed | Prefer loading search-data first so this path is rare |
| **MultiArtistInput.jsx** | `getDocs(collection(db, 'artists'))` | **All artists** | Same fallback | Same as above |
| **pages/admin/migrated-tabs.js** | `getDocs(collection(db, 'tabs'))` | **All tabs** | Admin: migrated tabs list load | Admin-only; could use getAllTabs() + cache |
| **pages/admin/merge-artists.js** | `getDocs(collection(db, 'artists'))` | **All artists** | Admin: merge tool | Admin-only |
| **pages/admin/artists-v2.js** | `getDocs(artists orderBy name)` | **All artists** | Admin: singer list | Admin-only |
| **pages/admin/artists.js** | `getDocs(collection(db, 'artists'))` | **All artists** | Admin (legacy?) | Admin-only |
| **pages/admin/artist-report.js** | artists + tabs | **All artists + all tabs** | Admin: report | Admin-only |
| **pages/admin/artists-region.js** | `getDocs(collection(db, 'artists'))` | **All artists** | Admin | Admin-only |
| **pages/admin/categorize-artists.js** | `getDocs(collection(db, 'artists'))` | **All artists** | Admin | Admin-only |
| **pages/admin/artists-sort.js** | `getDocs(collection(db, 'artists'))` | **All artists** | Admin | Admin-only |
| **pages/admin/update-spotify-photos.js** | `getDocs(artists orderBy name)` | **All artists** | Admin | Admin-only |
| **pages/api/migrate-tabs.js** | `getDocs(collection(db, 'tabs'))` | **All tabs** | Migration API | One-off / internal |

---

## 2. Where getAllTabs() is used

`getAllTabs()` uses Firestore cache `cache/allTabs` (24h TTL). When cache is warm = **1 read**. When cold = full tabs read then 1 write. Rebuild via admin Home settings or `POST /api/admin/rebuild-all-tabs-cache`.

| File | Usage |
|------|--------|
| `pages/admin/spotify-manager.js` | With getAllArtists(); bulk Spotify updates |
| `pages/admin/fix-artist.js` | With getAllArtists(); search/fix UNKNOWN artist |
| `pages/admin/data-review.js` | With getAllArtists(); **getAllTabs({ withContent: true })** — no cache, full read |
| `pages/admin/bulk-youtube.js` | Bulk YouTube thumbnail refresh |
| `pages/admin/bulk-update-year.js` | Bulk update upload year |
| `pages/admin/bulk-musicbrainz-year.js` | Bulk MusicBrainz year |
| `pages/admin/update-track-info.js` | Update track info |
| `pages/admin/test-rating.js` | Test rating UI |
| `pages/api/admin/analyze-tabs.js` | **getAllTabs({ withContent: true })** — full read |

---

## 3. Where getAllArtists() is used

`getAllArtists()` has **no Firestore cache**; 5-min in-memory cache only. Every cold hit = full artists collection read (~500 docs).

| File | Usage |
|------|--------|
| `lib/homeData.js` | `buildHomeDataPayload()` — home cache **cold** build |
| `pages/admin/spotify-manager.js` | With getAllTabs() |
| `pages/admin/hero-photos.js` | List artists for hero photo management |
| `pages/admin/fix-artist.js` | With getAllTabs() |
| `pages/admin/data-review.js` | With getAllTabs() |

**Reduction idea:** Add a Firestore cache doc for artists list (e.g. `cache/allArtists`, 24h TTL) and use it in `getAllArtists()` when building home/search payloads, so home cold doesn’t require full artists read every time.

---

## 4. User-facing pages (reads per visit)

| Page | Main reads | Notes |
|------|------------|--------|
| **Home** | **1** (cache/homePage, 6h TTL) | Cold: build ~65+ reads then 1 write |
| **Search / Artists list** | **1** (cache/searchData, 24h TTL) | Cold: ~3.2k tabs + ~500 artists then 1 write |
| **Artist page** | 1 (artist doc) + **getTabsByArtist (up to 6 queries × all matching tabs)** + 1 (saved) | **Main hot spot** — no limit on tab queries |
| **Tab (song) page** | 1 (tab, 5-min cache) + M (comments) | M = comment count |
| **Playlist page** | **1** (cache/playlist_{id}, 10 min) + 1 if logged in (saved) | Cold: getPlaylist + getPlaylistSongs + getAllActivePlaylists then 1 write |
| **Library** (logged in) | **1 HTTP** to `/api/me/library` (server: 4 queries + ceil(P/30) + ceil(A/30)) + client getTabsByIds(cover ids) + 1 recent | Single round-trip for user data; cover tabs batched on client. Fallback: direct Firestore if API fails. |
| **Library – Liked** | N (userLikedSongs) + N (getTabsByIds batched by 10) | 2N total |
| **Library – Recent** | getTabsByIds(up to 20) | Up to 20 reads (batched) |
| **Library – User playlist** | 1 (playlist doc) + getTabsByIds(songIds) | Batched by 10 |

---

## 5. API routes that hit Firestore

| Route | Reads | Notes |
|-------|-------|--------|
| `GET /api/search-data` | **1** (cache/searchData) when warm | 24h cache |
| `GET /api/home-data` | **1** (cache/homePage) when warm | 6h cache |
| `GET /api/artists` | **1** (getSearchData) | Same as search-data |
| `GET /api/playlist-page?id=...` | **1** (playlist page cache) when warm | 10 min cache; cold = getPlaylist + getPlaylistSongs + getAllActivePlaylists |
| `GET /api/me/library` | 4 queries + ceil(P/30) + ceil(A/30) | Auth: Bearer &lt;idToken&gt;. Returns likedSongIds, playlists, savedPlaylists, savedArtists in one response. |
| `POST /api/admin/rebuild-all-tabs-cache` | Writes cache only (uses buildAllTabsSlim) | After this, getAllTabs = 1 read for 24h |
| `POST /api/admin/analyze-tabs` | **getAllTabs({ withContent: true })** | Full tabs read |
| `pages/api/migrate-tabs.js` | getDocs(collection(tabs)) | Full tabs; migration use |

---

## 6. Cached reads (already optimized)

| Cache doc | TTL | Used by | Reads when warm |
|-----------|-----|---------|------------------|
| `cache/homePage` | 6h | Home, GET /api/home-data | 1 |
| `cache/searchData` | 24h | Search, artists list, dropdowns, tab cover fallback | 1 |
| `cache/allTabs` | 24h | getAllTabs() (admin tools) | 1 |
| `cache/playlist_{id}` | 10 min | Playlist page, GET /api/playlist-page | 1 |
| `cache/tabRequestsList` | Manual refresh | GET /api/tab-requests | 1 when warm; **full collection** when cold |
| In-memory (lib/tabs.js) | 5 min | getRecentTabs, getHotTabs, getPopularArtists, getAllArtists | 0 (after first hit per instance) |
| In-memory (lib/playlists.js) | 5 min | getAllActivePlaylists, getAutoPlaylists, getManualPlaylists | 0 (after first hit) |

---

## 6b. Why `/api/me/library` and tab-requests hit RESOURCE_EXHAUSTED (quota) and other pages don’t

| Path | Reads per request | Uses cache? | SDK |
|------|-------------------|------------|-----|
| **Home** (`/api/home-data`) | **1** when warm | ✅ `cache/homePage` | Client SDK (server-side) |
| **Search** (`/api/search-data`) | **1** when warm | ✅ `cache/searchData` | Client SDK |
| **Playlist page** | **1** when warm | ✅ `cache/playlist_{id}` | Admin (artist-page cache) / client |
| **Tab requests** (`getTabRequestsCache`) | **1** when warm; **N** (full collection) when cold | ✅ `cache/tabRequestsList` | **Admin SDK** |
| **Library** (`/api/me/library`) | **4 + ceil(P/30) + ceil(A/30)** every time | ❌ No cache | **Admin SDK** |

- **Other pages** (home, search, playlist, artist when cached): Do **1 read** when cache is warm (single doc). So many visits = still 1 read each. Quota is rarely hit.
- **`/api/me/library`**: Has **no cache**. Every library visit does 4+ queries plus batch reads for playlists/artists. Each visit adds a lot of reads; under traffic or on a tight quota this path quickly hits RESOURCE_EXHAUSTED.
- **Tab requests**: Uses Admin SDK to read **one cache doc** when warm (1 read). When the cache doc is **missing or cold**, the code falls back to **buildTabRequestsPayload()**, which reads the **entire `tabRequests` collection** (N reads). So cold tab-requests also adds many reads. If quota is already stressed, even the single cache read can return RESOURCE_EXHAUSTED.

**Takeaway:** Paths that hit quota either (1) have **no cache** and do many reads every time (api/me/library), or (2) use **Admin SDK** and when cache is cold do a full collection read (tab requests). To reduce quota errors: add a short-lived cache or Firestore cache doc for library (e.g. `cache/userLibrary/{uid}` or in-memory TTL), and ensure tab-requests cache is warmed (e.g. cron or manual rebuild after deploy) so cold builds are rare.

---

## 6c. Admin SDK vs Client SDK — can these two use Client SDK?

| | **Client SDK** (e.g. `lib/firebase` + `firestore-tracked`) | **Admin SDK** (`firebase-admin`) |
|--|----------------------------------------------------------------|----------------------------------|
| **Runs in** | Browser or Node (e.g. API route) | Node only (API routes, scripts) |
| **Auth** | Uses Firebase Auth in the app (user or anonymous). In Node there is no `request.auth` unless you sign in. | Uses a **service account**; **bypasses Firestore Rules**. Can read/write anything. |
| **Rules** | All requests checked against **Firestore Security Rules** (e.g. “read if request.auth.uid == userId”). | Rules are **not** applied; full access. |
| **Quota** | Same Firestore project quota as Admin. Switching SDK does **not** change total reads/writes. |

- **Tab-requests:** `cache/` and `tabRequests/` have **allow read: if true** in rules. So the server can read them with the **client SDK** (no signed-in user) the same way home-data reads `cache/homePage`. So **yes**, tab-requests can use the client SDK for the read path (1 read when warm; N reads when cold). Same number of reads, but no Admin SDK needed for reads.
- **Library (api/me/library):** userLikedSongs, userPlaylists, userSavedPlaylists, userSavedArtists require **request.auth.uid** to match the doc’s userId. In an API route the client SDK has **no user** (request.auth is null), so the server **cannot** read those collections with the client SDK. So **library data must either** (1) be read with **Admin SDK** on the server (after verifying the ID token), or (2) be read **in the browser** with the client SDK where the user is signed in — i.e. the existing **fetchLibraryDataLegacy** path. So the library *page* can use only the client SDK by not calling the API and always using the legacy client-side fetcher; the API itself cannot use the client SDK for user data.

---

## 7. Top recommendations to reduce Firebase requests

1. **Artist page:** Add `limit(50)` (or 100) to each of the 6 queries in `getTabsByArtist()`, and pagination / "Load more" so one visit doesn’t load every tab for big artists.
2. **getAllArtists:** Add a Firestore cache (e.g. `cache/allArtists`, 24h) and use it in `getAllArtists()` so home cold and any shared use don’t repeatedly read the full artists collection.
3. **Admin pages that need all artists:** Prefer a shared cache (e.g. searchData or a dedicated allArtists cache) instead of each page calling getDocs(artists) independently.
4. **Admin migrated-tabs:** Use `getAllTabs()` (cache/allTabs) instead of raw `getDocs(collection(db, 'tabs'))` so one rebuild serves all admin tools.
5. **Library cover tabs:** Use `getTabsByIds(tabIdsToFetch)` instead of `Promise.all(tabIdsToFetch.map(id => getDoc(doc(db, 'tabs', id))))` for consistent batching and one less read per doc (getDocs with `in` is still 1 read per doc but single round-trip).
6. **data-review / analyze-tabs:** They need full content. Consider running as background jobs or sampling (e.g. 500 tabs) instead of full getAllTabs({ withContent: true }) on every request.

---

## 8. Scripts (out of scope for request reduction)

Scripts under `scripts/` (e.g. `check-db.js`, `fix-all-artist-counts.js`, `find-suspicious-data.js`, `migrate-blogger.js`) do full collection reads by design for one-off batch jobs. No change needed unless they are run very frequently.

---

*Last updated: 2026-03-11. For more detail on high-rate paths and analytics, see [FIREBASE-READS-AUDIT.md](./FIREBASE-READS-AUDIT.md).*
