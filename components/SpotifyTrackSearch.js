import { useState, useEffect, useRef } from 'react';

export default function SpotifyTrackSearch({ 
  isOpen, 
  onClose, 
  artistName, 
  songTitle, 
  onSelect
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchArtist, setSearchArtist] = useState(artistName || '');
  const [searchTitle, setSearchTitle] = useState(songTitle || '');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showSearchForm, setShowSearchForm] = useState(false); // 有帶入歌手/歌名時預設收合，直接顯示結果
  const lastSearchTime = useRef(0);

  const searchSpotify = async (artist, title, customQuery = null, skipCooldown = false) => {
    if (!skipCooldown) {
      const now = Date.now();
      const timeSinceLastSearch = now - lastSearchTime.current;
      const minInterval = 1500;
      if (timeSinceLastSearch < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastSearch) / 1000);
        setError(`請等待 ${waitTime} 秒後再搜尋（避免 API 限制）`);
        return;
      }
    }
    lastSearchTime.current = Date.now();
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedTrack(null);

    try {
      const response = await fetch('/api/spotify/search-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          artist, 
          title,
          query: customQuery
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // 沒有搜尋結果，但不視為錯誤
          setResults([]);
        } else {
          throw new Error(data.error || '搜尋失敗');
        }
      }

      setResults(data.results || []);
      
      // 自動選擇第一個結果（如果有）
      if (data.results && data.results.length > 0) {
        setSelectedTrack(data.results[0]);
      }
    } catch (err) {
      console.error('Spotify search error:', err);
      setError(err.message || '搜尋失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchArtist(artistName || '');
      setSearchTitle(songTitle || '');
      setResults([]);
      setSelectedTrack(null);
      setError(null);
      setShowSearchForm(!(artistName && songTitle)); // 有帶入歌手+歌名時收合表單，直接顯示結果
      if (artistName && songTitle) {
        searchSpotify(artistName, songTitle, null, true); // 開 modal 時直接搜尋，跳過冷卻
      }
    }
  }, [isOpen, artistName, songTitle]);

  const handleSearch = () => {
    if (searchArtist || searchTitle) {
      searchSpotify(searchArtist, searchTitle);
    }
  };

  const handleSelect = () => {
    if (selectedTrack) {
      onSelect({
        // 歌曲資訊
        title: selectedTrack.name,
        artist: selectedTrack.artist,
        album: selectedTrack.album,
        songYear: selectedTrack.releaseYear,
        // Spotify 資訊
        spotifyTrackId: selectedTrack.id,
        spotifyAlbumId: selectedTrack.albumId,
        spotifyArtistId: selectedTrack.artistId,
        spotifyUrl: selectedTrack.spotifyUrl,
        albumImage: selectedTrack.albumImage,
        thumbnail: selectedTrack.thumbnail,
        duration: selectedTrack.duration,
        popularity: selectedTrack.popularity,
        previewUrl: selectedTrack.previewUrl
      });
      onClose();
    }
  };

  // 格式化時長
  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal 內容 */}
      <div className="relative bg-[#121212] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-neutral-800 flex flex-col">
        {/* 搜尋區：收合時「搜尋：…」+「更改關鍵字」+ 關閉鈕同一行；展開時表單上方有關閉鈕 */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
          {showSearchForm ? (
            <>
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-white transition"
                  aria-label="關閉"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">
                    歌手名 <span className="text-[#FFD700]">*</span>
                  </label>
                  <input
                    type="text"
                    value={searchArtist}
                    onChange={(e) => setSearchArtist(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-white text-sm outline-none"
                    placeholder="例如：陳奕迅、Beyond"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">
                    歌名 <span className="text-[#FFD700]">*</span>
                  </label>
                  <input
                    type="text"
                    value={searchTitle}
                    onChange={(e) => setSearchTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-neutral-700 rounded-lg text-white text-sm outline-none"
                    placeholder="例如：海闊天空"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSearch}
                  disabled={loading || (!searchArtist && !searchTitle)}
                  className="px-4 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  {loading ? '搜尋中...' : '搜尋 Spotify'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm text-neutral-400 truncate">
                搜尋：<span className="text-white">{searchArtist || '—'}</span> · <span className="text-white">{searchTitle || '—'}</span>
              </p>
              <button
                type="button"
                onClick={() => setShowSearchForm(true)}
                className="flex-shrink-0 text-sm text-[#1DB954] hover:text-[#1ed760] transition"
              >
                更改關鍵字
              </button>
              <div className="flex-1 min-w-0" aria-hidden="true" />
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 text-neutral-400 hover:text-white transition"
                aria-label="關閉"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* 內容區 */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {loading ? (
            /* 載入中 */
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 animate-spin text-[#1DB954] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-neutral-400">搜尋 Spotify...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
            </div>
          ) : results.length > 0 ? (
            /* 搜尋結果 */
            <div>
              <p className="text-sm text-neutral-400 mb-2">
                找到 {results.length} 個結果，請選擇最符合嘅一首：
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((track) => (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrack(track)}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition ${
                    selectedTrack?.id === track.id
                      ? 'bg-[#1DB954]/10 border-[#1DB954]'
                      : 'bg-black border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {/* 專輯封面 */}
                  <img
                    src={track.thumbnail}
                    alt={track.album}
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text fill="%23666" x="50" y="50" text-anchor="middle" font-size="12">No Image</text></svg>';
                    }}
                  />
                  
                  {/* 歌曲資訊 */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium truncate ${
                      selectedTrack?.id === track.id ? 'text-[#1DB954]' : 'text-white'
                    }`}>
                      {track.name}
                    </h4>
                    <p className="text-sm text-neutral-400 truncate">
                      {track.artist}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {track.album} · {track.releaseYear}
                    </p>
                  </div>
                  
                  {/* 時長 */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-neutral-500">
                      {formatDuration(track.duration)}
                    </span>
                    {selectedTrack?.id === track.id && (
                      <div className="text-[#1DB954] text-xs mt-1">已選擇</div>
                    )}
                  </div>
                </button>
              ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              {!searchArtist && !searchTitle ? (
                <p className="text-neutral-500 mb-2">請輸入歌手名和歌名進行搜尋</p>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 bg-neutral-800 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-neutral-400 mb-2">Spotify 找不到結果</p>
                  <p className="text-sm text-neutral-500 mb-4">試下調整歌手名或歌名再搜尋</p>
                  <button
                    onClick={() => searchSpotify(searchArtist, searchTitle)}
                    className="px-3 py-1.5 text-sm bg-neutral-700 text-white rounded hover:bg-neutral-600 transition"
                  >
                    重新搜尋
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-black/50">
            <div className="flex justify-between items-center">
              <div className="text-xs text-neutral-500">
                {selectedTrack ? (
                  <span>
                    已選擇：<span className="text-white">{selectedTrack.name}</span> - {selectedTrack.artist}
                  </span>
                ) : results.length > 0 ? (
                  '請選擇一首歌曲'
                ) : (
                  'Spotify 搜尋'
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSelect}
                  disabled={!selectedTrack}
                  className="px-4 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  使用此歌曲資訊
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
