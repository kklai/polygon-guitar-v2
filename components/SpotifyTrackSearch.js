import { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (isOpen) {
      setManualArtist(artistName || '');
      setManualTitle(songTitle || '');
      if (artistName && songTitle) {
        searchSpotify(artistName, songTitle);
      }
    }
  }, [isOpen, artistName, songTitle]);

  const searchSpotify = async (artist, title, customQuery = null) => {
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
        throw new Error(data.error || '搜尋失敗');
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
      <div className="relative bg-[#121212] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              🎵 Spotify 歌曲搜尋
            </h2>
            <p className="text-sm text-gray-400">
              自動搜尋歌曲資訊（歌手、專輯、年份等）
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

        {/* 手動調整區 */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/30">
          <h3 className="text-sm font-medium text-[#FFD700] mb-3">調整搜尋關鍵字</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">歌手名</label>
              <input
                type="text"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                placeholder="輸入歌手名"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">歌名</label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded-lg text-white text-sm focus:border-[#FFD700] focus:outline-none"
                placeholder="輸入歌名"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleManualSearch}
              disabled={loading || (!manualArtist && !manualTitle)}
              className="px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
            >
              {loading ? '搜尋中...' : '🔍 重新搜尋'}
            </button>
            <button
              onClick={handleUseManual}
              disabled={!manualTitle}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50 text-sm"
            >
              跳過搜尋，使用手動輸入
            </button>
          </div>
        </div>

        {/* 內容區 */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 animate-spin text-[#FFD700] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-400">搜尋 Spotify...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <p className="text-sm text-gray-500 mb-4">
                找不到結果？請嘗試調整上方嘅歌手名或歌名
              </p>
              <button
                onClick={handleUseManual}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                使用手動輸入的資料
              </button>
            </div>
          ) : results.length > 0 ? (
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
                      ? 'bg-[#FFD700]/10 border-[#FFD700]'
                      : 'bg-black border-gray-800 hover:border-gray-600'
                  }`}
                >
                  {/* 專輯封面 */}
                  <img 
                    src={track.thumbnail} 
                    alt={track.album}
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                  />
                  
                  {/* 歌曲資訊 */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium truncate ${
                      selectedTrack?.id === track.id ? 'text-[#FFD700]' : 'text-white'
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
                      <div className="text-[#FFD700] text-xs mt-1">✓ 已選擇</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">請輸入歌手名和歌名進行搜尋</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-black/50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {selectedTrack ? (
                <span>
                  已選擇：<span className="text-white">{selectedTrack.name}</span> - {selectedTrack.artist}
                </span>
              ) : (
                '請選擇一首歌曲或手動輸入'
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
      </div>
    </div>
  );
}
