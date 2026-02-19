import { useState, useEffect } from 'react';
import { searchArtistFromWikipedia } from '@/lib/wikipedia';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ArtistAutoFill({ 
  artistName, 
  onFill, 
  className = '',
  skipIfExists = true, // 如果歌手已存在且有資料，跳過搜尋
  autoApply = false, // 自動應用搜尋結果（無需確認）
  disabled = false // 完全停用搜尋（當用戶已選擇現有歌手時）
}) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [existingArtist, setExistingArtist] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);

  // 檢查歌手是否已存在
  useEffect(() => {
    const checkExistingArtist = async () => {
      if (disabled) {
        setExistingArtist(null);
        setHasChecked(true);
        return;
      }
      
      if (!artistName?.trim() || !skipIfExists) {
        setExistingArtist(null);
        setHasChecked(true);
        return;
      }

      setChecking(true);
      try {
        const artistId = artistName.toLowerCase().replace(/\s+/g, '-');
        const artistRef = doc(db, 'artists', artistId);
        const artistSnap = await getDoc(artistRef);
        
        if (artistSnap.exists()) {
          const data = artistSnap.data();
          // 檢查是否已有資料（photo, bio, year 任何一個）
          if (data.photo || data.bio || data.year) {
            setExistingArtist(data);
          } else {
            setExistingArtist(null);
          }
        } else {
          setExistingArtist(null);
        }
      } catch (err) {
        console.error('檢查歌手錯誤:', err);
        setExistingArtist(null);
      }
      setChecking(false);
      setHasChecked(true);
    };

    // Debounce 檢查，避免用戶每打一個字都檢查
    const timer = setTimeout(() => {
      checkExistingArtist();
    }, 500);

    return () => clearTimeout(timer);
  }, [artistName, skipIfExists]);

  // 自動搜尋模式：當歌手不存在且有輸入時自動搜尋
  useEffect(() => {
    if (disabled) return;
    if (!autoApply || !hasChecked || !artistName?.trim()) return;
    if (existingArtist) return; // 已存在，不搜尋
    
    const timer = setTimeout(() => {
      handleSearch();
    }, 800);

    return () => clearTimeout(timer);
  }, [artistName, hasChecked, existingArtist, autoApply, disabled]);

  const handleSearch = async () => {
    if (!artistName?.trim()) return;
    
    setLoading(true);
    setError(null);
    setPreview(null);
    
    const data = await searchArtistFromWikipedia(artistName);
    
    if (data) {
      if (autoApply) {
        // 自動應用，無需確認
        onFill({
          name: data.name,
          photo: data.photo,
          bio: data.bio,
          year: data.year,
          birthYear: data.birthYear,
          debutYear: data.debutYear,
          artistType: data.artistType
        });
      } else {
        setPreview(data);
      }
    } else {
      setError('搵唔到資料（可能維基百科未有呢個歌手）');
    }
    
    setLoading(false);
  };

  const handleConfirm = () => {
    if (preview) {
      onFill({
        name: preview.name,
        photo: preview.photo,
        bio: preview.bio,
        year: preview.year,
        birthYear: preview.birthYear,
        debutYear: preview.debutYear,
        artistType: preview.artistType
      });
      setPreview(null);
    }
  };

  // 如果歌手已存在且有資料，顯示提示而不顯示搜尋按鈕
  if (existingArtist && skipIfExists) {
    return (
      <div className={`p-4 bg-green-900/20 border border-green-800 rounded-lg ${className}`}>
        <div className="flex items-center gap-3">
          {existingArtist.photo && (
            <img
              src={existingArtist.photo}
              alt={existingArtist.name}
              loading="lazy"
              decoding="async"
              className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
            />
          )}
          <div className="flex-1">
            <p className="text-green-400 text-sm font-medium">
              歌手資料已存在
            </p>
            <p className="text-gray-400 text-xs">
              {existingArtist.name} • {existingArtist.year || '無年份'} • 
              {existingArtist.artistType ? 
                (existingArtist.artistType === 'male' ? '男歌手' : 
                 existingArtist.artistType === 'female' ? '女歌手' : '組合') + ' • ' 
                : ''}
              已有 {existingArtist.tabCount || 0} 個譜
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExistingArtist(null)}
            className="text-xs text-gray-500 hover:text-white underline"
          >
            重新搜尋
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 自動搜尋按鈕 */}
      <button
        type="button"
        onClick={handleSearch}
        disabled={loading || !artistName?.trim() || checking}
        className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading || checking ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{checking ? '檢查緊...' : '搜尋緊...'}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>自動搵歌手資料</span>
          </>
        )}
      </button>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 預覽結果 */}
      {preview && (
        <div className="mt-4 p-4 bg-[#1a1a1a] border-l-4 border-[#FFD700] rounded-lg">
          <h4 className="text-[#FFD700] font-medium mb-3">搵到資料！請確認：</h4>
          
          <div className="flex gap-4 mb-4">
            {preview.photo && (
              <img
                src={preview.photo}
                alt={preview.name}
                loading="lazy"
                decoding="async"
                className="w-20 h-20 rounded-full object-cover border-2 border-[#FFD700]"
              />
            )}
            <div className="flex-1">
              <div className="mb-1">
                <span className="text-gray-500 text-sm">名稱：</span>
                <span className="text-white">{preview.name}</span>
              </div>
              
              {preview.birthYear && (
                <div className="mb-1">
                  <span className="text-gray-500 text-sm">出生年份：</span>
                  <span className="text-white">{preview.birthYear}</span>
                </div>
              )}
              
              {preview.debutYear && (
                <div className="mb-1">
                  <span className="text-gray-500 text-sm">出道年份：</span>
                  <span className="text-white">{preview.debutYear}</span>
                </div>
              )}
              
              {preview.artistType && preview.artistType !== 'unknown' && (
                <div className="mb-1">
                  <span className="text-gray-500 text-sm">類型：</span>
                  <span className="text-white">
                    {preview.artistType === 'male' ? '男歌手' : 
                     preview.artistType === 'female' ? '女歌手' : '組合'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <span className="text-gray-500 text-sm">簡介：</span>
            <p className="text-gray-300 text-sm mt-1 leading-relaxed">
              {preview.bio.substring(0, 150)}...
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>確認使用</span>
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm"
            >
              取消
            </button>
          </div>
          
          <a 
            href={preview.wikipediaUrl} 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-[#FFD700] text-sm hover:underline"
          >
            喺維基百科睇完整資料
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
