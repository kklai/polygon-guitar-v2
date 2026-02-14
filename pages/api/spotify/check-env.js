// 檢查 Spotify 環境變數
export default function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || ''
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || ''
  
  // 去除空格後檢查
  const cleanClientId = clientId.trim()
  const cleanClientSecret = clientSecret.trim()
  
  res.status(200).json({
    clientIdExists: !!cleanClientId,
    clientIdLength: cleanClientId.length,
    clientSecretExists: !!cleanClientSecret,
    secretLength: cleanClientSecret.length,
    // 顯示頭尾幾個字（安全起見）
    clientIdPreview: cleanClientId ? `${cleanClientId.substring(0, 8)}...${cleanClientId.substring(cleanClientId.length - 4)}` : null
  })
}
