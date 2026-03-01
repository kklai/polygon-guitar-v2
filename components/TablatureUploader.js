import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

/**
 * 六線譜文件上傳組件
 * 支援拖放上傳 Guitar Pro / MusicXML / MIDI 文件
 */
export default function TablatureUploader({ 
  onFileLoaded,    // 文件載入成功回調 (fileData, fileName) => void
  onError,         // 錯誤回調 (error) => void
  maxSize = 10 * 1024 * 1024  // 最大 10MB
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  // 支援的檔案格式
  const acceptedFormats = {
    'application/octet-stream': ['.gp3', '.gp4', '.gp5', '.gpx'],
    'audio/midi': ['.mid', '.midi'],
    'application/xml': ['.xml', '.musicxml'],
    'text/plain': ['.txt']  // ASCII Tab
  };

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    // 處理拒絕的文件
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0].code === 'file-too-large') {
        onError?.(new Error('檔案太大，最大支援 10MB'));
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        onError?.(new Error('不支援的檔案格式，請上傳 .gp3/4/5 .gpx .mid .xml'));
      }
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsLoading(true);

    try {
      // 讀取文件為 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 設置預覽
      setPreview({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: getFileTypeName(file.name)
      });

      // 回調
      onFileLoaded?.(arrayBuffer, file.name);
    } catch (err) {
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoaded, onError]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    maxSize,
    multiple: false
  });

  // 獲取檔案類型名稱
  const getFileTypeName = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'gp3': 'Guitar Pro 3',
      'gp4': 'Guitar Pro 4',
      'gp5': 'Guitar Pro 5',
      'gpx': 'Guitar Pro 6/7',
      'mid': 'MIDI',
      'midi': 'MIDI',
      'xml': 'MusicXML',
      'musicxml': 'MusicXML',
      'txt': 'ASCII Tab'
    };
    return typeMap[ext] || '未知格式';
  };

  return (
    <div className="space-y-4">
      {/* 拖放區域 */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragActive && !isDragReject ? 'border-[#FFD700] bg-yellow-900/10' : ''}
          ${isDragReject ? 'border-red-500 bg-red-900/10' : ''}
          ${!isDragActive && !isDragReject ? 'border-gray-700 hover:border-gray-600 bg-[#1a1a1a]' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isLoading ? (
          <div className="py-4">
            <svg className="w-10 h-10 mx-auto mb-3 text-[#FFD700] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400">載入文件中...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            
            {isDragActive ? (
              <p className="text-[#FFD700] font-medium">放開以上傳文件</p>
            ) : (
              <>
                <p className="text-white font-medium mb-2">
                  拖放六線譜文件到這裡，或點擊選擇
                </p>
                <p className="text-gray-500 text-sm">
                  支援 Guitar Pro (.gp3/4/5 .gpx)、MIDI (.mid)、MusicXML (.xml)
                </p>
              </>
            )}
          </>
        )}
      </div>

      {/* 檔案預覽 */}
      {preview && (
        <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-lg border border-gray-800">
          <div className="w-12 h-12 bg-[#FFD700] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{preview.name}</p>
            <p className="text-gray-500 text-sm">{preview.type} · {preview.size}</p>
          </div>
          <button
            onClick={() => {
              setPreview(null);
              onFileLoaded?.(null, null);
            }}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 格式說明 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { ext: '.gp3/4/5', name: 'Guitar Pro 3-5', color: 'bg-green-900/30 text-green-400' },
          { ext: '.gpx', name: 'Guitar Pro 6/7', color: 'bg-blue-900/30 text-blue-400' },
          { ext: '.mid', name: 'MIDI', color: 'bg-purple-900/30 text-purple-400' },
          { ext: '.xml', name: 'MusicXML', color: 'bg-orange-900/30 text-orange-400' }
        ].map((format) => (
          <div key={format.ext} className={`p-3 rounded-lg ${format.color} border border-current border-opacity-20`}>
            <p className="font-mono font-bold">{format.ext}</p>
            <p className="text-xs opacity-80">{format.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
