# Tab artist fields simplification

## Goal

Stop storing denormalized artist data on each tab so that when artist data (name, photo, region, etc.) is updated, tabs never show outdated info. Keep only a stable reference: an array of artist document IDs + role (main / feat).

---

## Current fields on tab (artist-related)

| Field | Purpose today | Problem |
|-------|----------------|---------|
| `artistId` | Main artist doc ID; was used for query | **Removed** (use `artistIds[0]` or `artists[0].id`; read path uses `getTabArtistId(tab)`) |
| `artists` | (Sometimes) array from form | **Replace** with canonical shape below |
| `collaboratorIds` | All participant doc IDs; was used for `array-contains` | **Removed** (replaced by `artistIds`) |
| `collaborators` | Display names (denormalized) | **Remove** (resolve from artist map) |
| `artistBio` | Copied from artist | **Remove** |
| `artistBirthYear` | Copied from artist | **Remove** |
| `artistDebutYear` | Copied from artist | **Remove** |
| `artistPhoto` | Fallback cover / avatar | **Remove** (resolve from artist doc or map) |
| `artistType` | Copied from artist | **Remove** |
| `artistYear` | Copied from artist | **Remove** |
| `region` | Copied from artist | **Remove** |

---

## Proposed stored shape on tab

Only these artist-related fields stay on the document:

```js
{
  // Canonical list: order = display order; role = main vs featuring
  artists: [
    { id: 'artistDocId1', role: 'main' },
    { id: 'artistDocId2', role: 'feat' }
  ],
  // Flat array for Firestore query: where('artistIds', 'array-contains', artistId)
  artistIds: ['artistDocId1', 'artistDocId2'],
  collaborationType: 'feat',   // 'feat' | 'slash' (for display separator)
  isCollaboration: true
}
```

- **Display names**: Always from artist map or `getArtistByIdOrSlug(id)` — never from tab.
- **Photo / bio / type / region**: Always from artist doc (or search cache / artist map when available).
- **Main artist id** at read time: `getTabArtistId(tab)` → `tab.artistId ?? tab.artists?.[0]?.id ?? tab.artistIds?.[0]` (supports legacy docs that still have `artistId`).
- **All artist ids** at read time: `getTabArtistIds(tab)` → `tab.artistIds ?? tab.artists?.map(a => a.id) ?? tab.collaboratorIds ?? [tab.artistId]`.

Queries use `where('artistIds', 'array-contains', artistId)` (and for backward compat also `where('artistId', '==', artistId)` and `where('collaboratorIds', 'array-contains', artistId)` until all tabs are migrated).

---

## Could this cause bugs?

### 1. **Queries**

- **Risk**: If we only stored `artists: [{ id, role }]` and removed `artistId` / `collaboratorIds`, we could not run the current `getTabsByArtist` (single query with `artistId` + `collaboratorIds`).
- **Mitigation**: Keep `artistId` and `collaboratorIds` as **derived** fields written from `artists` on create/update. No query changes; no bug.

### 2. **Display (name / photo) on tab page and cards**

- **Risk**: Code that reads `tab.artist`, `tab.artistName`, `tab.artistPhoto` would get empty after we stop writing them.
- **Mitigation**: All display already prefers artist map / `getArtistName(tab)` / `getArtistByIdOrSlug`. Ensure every remaining path uses those and only falls back to `tab.artist` / `tab.artistName` / `tab.artistPhoto` for **backward compatibility** with old documents. New tabs won’t have those fields; they’ll still show correctly via map/doc. Old tabs keep working during transition.

### 3. **Cover image fallback (e.g. tab page, cards)**

- **Risk**: Today some places use `tab.artistPhoto` when there’s no cover/thumbnail. Removing it could leave “no image” until artist is loaded.
- **Mitigation**: Resolve “artist photo” from artist doc or artist map by `artistId` (and collaborators if needed). You already have patterns (e.g. search-data fallback, `allArtists`). Standardise so that when tab has no `artistPhoto`, the UI fetches or uses map for `tab.artistId` (and `tab.collaboratorIds` if you show multiple). Then removing `artistPhoto` from tab does not break UI.

### 4. **Edit form (new/edit tab)**

- **Risk**: Form currently sends `artistPhoto`, `artistBio`, `artistYear`, `artistType`, `region` and they get written onto the tab and passed to `getOrCreateArtist`.
- **Mitigation**: Continue passing those to `getOrCreateArtist` when creating/updating **artist** docs only. Do **not** write them to the tab. Form can still collect them for the “create new artist” flow; they just don’t get stored on the tab.

### 5. **Backward compatibility**

- **Risk**: Existing tabs have `artist`, `artistName`, `collaborators`, `artistPhoto`, etc. If we only read from `artists` + map, old tabs without `artists` could break.
- **Mitigation**:
  - **Read path**: Prefer `artists`; if missing, derive from `artistId` + `collaboratorIds` (e.g. `artists = [{ id: tab.artistId, role: 'main' }, ...tab.collaboratorIds.filter(id => id !== tab.artistId).map(id => ({ id, role: 'feat' }))]`). For name/photo, keep fallback to `tab.artist`, `tab.artistName`, `tab.artistPhoto` until a one-time migration strips them.
  - **Write path**: Never write `artist`, `artistName`, `artistSlug`, `artistPhoto`, `artistBio`, `artistYear`, `artistType`, `region`, etc. Only write `artists`, `artistId`, `collaboratorIds`, `collaborationType`, `isCollaboration`.

### 6. **Relation / collaborationType**

- **Risk**: Form uses `relation` (e.g. feat / slash). Display uses `collaborationType` for “feat.” vs “ / ”.
- **Mitigation**: Keep `collaborationType` on the tab (one value per tab). Map form `relation` → `collaborationType` on save. No need to store per-artist role beyond main vs feat if that’s enough; otherwise store in `artists[i].role` and derive `collaborationType` from the second artist’s relation if you need it.

### 7. **Admin / scripts**

- **Risk**: Scripts or admin pages that assume `tab.artist`, `tab.artistName`, or other removed fields could break.
- **Mitigation**: Grep for those fields and switch to artist map or `getArtistByIdOrSlug` (or batch-load artists by id). List of places is in the repo grep results; update them as part of this change.

---

## Summary

- **Remove from tab (stop writing, eventually delete in migration):**  
  `artist`, `artistName`, `artistSlug`, `artistBio`, `artistBirthYear`, `artistDebutYear`, `artistPhoto`, `artistType`, `artistYear`, `region`, `collaborators` (names).
- **Keep / add:**  
  `artists: [{ id, role }]`, `artistId` (derived), `collaboratorIds` (derived), `collaborationType`, `isCollaboration`.
- **Bugs to avoid:**  
  Keep query fields; resolve all display and cover from artist map/doc; keep read fallbacks for old docs; don’t write denormalized artist fields to tab; update admin/scripts to use artist id + map/doc.

This gives you a single source of truth (artist doc ID + role on the tab) and no outdated artist info on tabs when you update an artist.
