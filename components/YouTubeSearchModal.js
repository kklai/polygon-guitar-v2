import { useState, useEffect } from 'react';

export default function YouTubeSearchModal({ 
  isOpen, 
  onClose, 
  artistName, 
  songTitle, 
  onSelect,
  autoSelectFirst = false // 自動選擇第一個結果
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && artistName && songTitle) {
      searchYouTube();
    }
  }, [isOpen, artistName, songTitle]);

  const searchYouTube = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // 組合搜尋關鍵字
      const query = `${artistName} ${songTitle}`;
      
      // 使用 YouTube Data API v3
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      
      if (!API_KEY || API_KEY === 'your_youtube_api_key_here') {
        // API Key 未設定，直接開 YouTube
        console.log('YouTube API Key 未設定，fallback 到外部搜尋');
        openYouTubeSearch();
        return;
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(query)}&` +
        `type=video&` +
        `maxResults=5&` +
        `relevanceLanguage=zh-HK&` +
        `key=${API_KEY}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('YouTube API Error:', errorData);
        
        if (response.status === 403) {
          if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
            throw new Error('API quota 已用完');
          }
          throw new Error('API Key 無效或未啟用 YouTube API');
        }
        throw new Error(`搜尋失敗 (${response.status})`);
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // 如果啟用自動選擇，直接選第一個結果
        if (autoSelectFirst) {
          const firstVideo = data.items[0];
          const url = `https://www.youtube.com/watch?v=${firstVideo.id.videoId}`;
          onSelect(url);
          onClose();
          return;
        }
        
        // 獲取影片詳細資訊（包括時長）
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?` +
          `part=contentDetails,snippet&` +
          `id=${videoIds}&` +
          `key=${API_KEY}`
        );
        
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          const videos = data.items.map(item => {
            const detail = detailsData.items?.find(d => d.id === item.id.videoId);
            return {
              videoId: item.id.videoId,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
              duration: detail?.contentDetails?.duration ? formatDuration(detail.contentDetails.duration) : ''
            };
          });
          setResults(videos);
        } else {
          // 如果無法獲取詳細資訊，只顯示基本資訊
          const videos = data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            duration: ''
          }));
          setResults(videos);
        }
      } else {
        setError('搵唔到相關影片');
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setError('搜尋失敗，可能 API quota 已用完');
    } finally {
      setLoading(false);
    }
  };

  // 格式化 ISO 8601 時長為可讀格式
  const formatDuration = (isoDuration) => {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 選擇影片
  const handleSelect = (video) => {
    const url = `https://www.youtube.com/watch?v=${video.videoId}`;
    onSelect(url);
    onClose();
  };

  // 開啟 YouTube 搜尋（後備方案）
  const openYouTubeSearch = () => {
    const query = encodeURIComponent(`${artistName} ${songTitle}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
    onClose();
  };

  // 截斷標題
  const truncateTitle = (title, maxLength = 50) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
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
      <div className="relative bg-[#121212] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              YouTube 搜尋結果
            </h2>
            <p className="text-sm text-neutral-400">
              「{artistName} {songTitle}」
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 animate-spin text-[#FFD700] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-neutral-400">搜尋緊 YouTube...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              
              {/* API Key 問題指引 */}
              {error.includes('API Key') && (
                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-left text-sm">
                  <p className="text-yellow-400 font-medium mb-2">解決方法：</p>
                  <ol className="text-yellow-200/80 list-decimal list-inside space-y-1">
                    <li>去 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline hover:text-yellow-400">Google Cloud Console</a></li>
                    <li>確認已啟用「YouTube Data API v3」</li>
                    <li>檢查 API Key 是否正確填入 .env.local</li>
                    <li>重新啟動 dev server</li>
                  </ol>
                </div>
              )}
              
              {/* Quota 問題指引 */}
              {error.includes('quota') && (
                <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700 rounded text-left text-sm">
                  <p className="text-orange-400 font-medium mb-2">Quota 已用完</p>
                  <p className="text-orange-200/80">
                    YouTube API 每日有 10,000 quota 限制。<br/>
                    建議：使用下方按鈕直接開 YouTube 搜尋
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 justify-center">
                <button
                  onClick={searchYouTube}
                  className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition"
                >
                  重試
                </button>
                <button
                  onClick={openYouTubeSearch}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                  去 YouTube 搜尋
                </button>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.map((video) => (
                <button
                  key={video.videoId}
                  onClick={() => handleSelect(video)}
                  className="group bg-black rounded-lg overflow-hidden border border-neutral-800 hover:border-[#FFD700] transition text-left"
                >
                  {/* 縮圖 */}
                  <div className="relative aspect-video">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {video.duration}
                      </span>
                    )}
                    {/* 播放圖標 */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                      <div className="w-12 h-12 bg-[#FFD700] rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* 資訊 */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-white line-clamp-2 mb-1 group-hover:text-[#FFD700] transition">
                      {truncateTitle(video.title)}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {video.channelTitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-black/50">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <p className="text-sm text-neutral-500">
              搵唔到啱心水？可以自己去 YouTube 搜尋
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-neutral-400 hover:text-white transition"
              >
                取消
              </button>
              <button
                onClick={openYouTubeSearch}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                去 YouTube 搜尋
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
