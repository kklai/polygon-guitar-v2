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
  const [manualArtist, setManualArtist] = useState(artistName || '');
  const [manualTitle, setManualTitle] = useState(songTitle || '');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'
  const [cooldown, setCooldown] = useState(0);
  const lastSearchTime = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setManualArtist(artistName || '');
      setManualTitle(songTitle || '');
      setMode('auto');
      setResults([]);
      setSelectedTrack(null);
      setError(null);
      
      // 自動搜尋（如果提供了歌手和歌名）
      if (artistName && songTitle) {
        searchSpotify(artistName, songTitle);
      }
    }
  }, [isOpen, artistName, songTitle]);

  const searchSpotify = async (artist, title, customQuery = null) => {
    // 檢查冷卻時間（避免 rate limit）
    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTime.current;
    const minInterval = 1500; // 最少 1.5 秒間隔
    
    if (timeSinceLastSearch < minInterval) {
      const waitTime = Math.ceil((minInterval - timeSinceLastSearch) / 1000);
      setError(`請等待 ${waitTime} 秒後再搜尋（避免 API 限制）`);
      return;
    }
    
    lastSearchTime.current = now;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedTrack(null);
    setMode('auto');

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

  const handleManualSearch = () => {
    if (manualArtist || manualTitle) {
      searchSpotify(manualArtist, manualTitle);
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

  const handleUseManual = () => {
    onSelect({
      title: manualTitle,
      artist: manualArtist,
      // 沒有 Spotify 資訊
      spotifyTrackId: null
    });
    onClose();
  };

  const switchToManualMode = () => {
    setMode('manual');
    setResults([]);
    setSelectedTrack(null);
    setError(null);
  };

  const switchToAutoMode = () => {
    setMode('auto');
    if (manualArtist || manualTitle) {
      searchSpotify(manualArtist, manualTitle);
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
      <div className="relative bg-[#121212] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              歌曲資訊搜尋
            </h2>
            <p className="text-sm text-gray-400">
              從 Spotify 自動獲取歌曲資訊，或手動輸入
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 模式切換 Tab */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={switchToAutoMode}
            className={`flex-1 py-3 text-sm font-medium transition ${
              mode === 'auto' 
                ? 'text-[#1DB954] border-b-2 border-[#1DB954] bg-[#1DB954]/5' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Spotify 搜尋
          </button>
          <button
            onClick={switchToManualMode}
            className={`flex-1 py-3 text-sm font-medium transition ${
              mode === 'manual' 
                ? 'text-[#FFD700] border-b-2 border-[#FFD700] bg-[#FFD700]/5' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            手動輸入
          </button>
        </div>

        {/* 手動輸入區 - 兩個模式都顯示 */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                歌手名 <span className="text-[#FFD700]">*</span>
              </label>
              <input
                type="text"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                placeholder="例如：陳奕迅、Beyond"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                歌名 <span className="text-[#FFD700]">*</span>
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                placeholder="例如：海闊天空"
              />
            </div>
          </div>
          
          {mode === 'auto' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleManualSearch}
                disabled={loading || (!manualArtist && !manualTitle)}
                className="px-4 py-2 bg-[#1DB954] text-white rounded-lg font-medium hover:bg-[#1ed760] transition disabled:opacity-50 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                {loading ? '搜尋中...' : '搜尋 Spotify'}
              </button>
              <button
                onClick={switchToManualMode}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm"
              >
                找不到？手動輸入
              </button>
            </div>
          )}
        </div>

        {/* 內容區 */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {mode === 'manual' ? (
            /* 手動輸入模式 */
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#FFD700]/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">手動輸入模式</h3>
              <p className="text-gray-400 text-sm mb-6">
                將直接使用上方輸入的歌手名和歌名<br/>
                不會從 Spotify 獲取額外資訊（如專輯封面、年份等）
              </p>
              
              <div className="bg-black rounded-lg p-4 mb-6 text-left">
                <p className="text-gray-400 text-sm mb-2">將會使用以下資訊：</p>
                <div className="space-y-1">
                  <p className="text-white">
                    <span className="text-gray-500">歌手：</span>
                    {manualArtist || <span className="text-red-400">（未輸入）</span>}
                  </p>
                  <p className="text-white">
                    <span className="text-gray-500">歌名：</span>
                    {manualTitle || <span className="text-red-400">（未輸入）</span>}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={switchToAutoMode}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  返回搜尋
                </button>
                <button
                  onClick={handleUseManual}
                  disabled={!manualArtist || !manualTitle}
                  className="px-6 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確認使用手動輸入
                </button>
              </div>
            </div>
          ) : loading ? (
            /* 載入中 */
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 animate-spin text-[#1DB954] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-400">搜尋 Spotify...</p>
            </div>
          ) : error ? (
            /* 錯誤 */
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={switchToManualMode}
                className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-yellow-400 transition"
              >
                改為手動輸入
              </button>
            </div>
          ) : results.length > 0 ? (
            /* 搜尋結果 */
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-2">
                找到 {results.length} 個結果，請選擇最符合嘅一首：
              </p>
              {results.map((track) => (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrack(track)}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition ${
                    selectedTrack?.id === track.id
                      ? 'bg-[#1DB954]/10 border-[#1DB954]'
                      : 'bg-black border-gray-800 hover:border-gray-600'
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
                    <p className="text-sm text-gray-400 truncate">
                      {track.artist}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {track.album} · {track.releaseYear}
                    </p>
                  </div>
                  
                  {/* 時長 */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {formatDuration(track.duration)}
                    </span>
                    {selectedTrack?.id === track.id && (
                      <div className="text-[#1DB954] text-xs mt-1">已選擇</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* 沒有結果 / 初始狀態 */
            <div className="text-center py-8">
              {!manualArtist && !manualTitle ? (
                <>
                  <p className="text-gray-500 mb-2">請輸入歌手名和歌名進行搜尋</p>
                  <p className="text-xs text-gray-600">或點擊「手動輸入」直接填寫</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 mb-2">Spotify 找不到結果</p>
                  <p className="text-sm text-gray-500 mb-4">
                    試下調整歌手名或歌名，<br/>或者改用「手動輸入」
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => searchSpotify(manualArtist, manualTitle)}
                      className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                    >
                      重新搜尋
                    </button>
                    <button
                      onClick={switchToManualMode}
                      className="px-3 py-1.5 text-sm bg-[#FFD700] text-black rounded hover:bg-yellow-400 transition"
                    >
                      手動輸入
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'auto' && (
          <div className="p-4 border-t border-gray-800 bg-black/50">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
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
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
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
        )}
      </div>
    </div>
  );
}
