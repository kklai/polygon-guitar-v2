// 檢查 Spotify 環境變數並測試 Basic Auth encode
export default function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || ''
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || ''
  
  // 顯示原始值（頭尾幾個字符）
  const rawIdPreview = clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}` : 'EMPTY'
  const rawSecretLength = clientSecret.length
  
  // 去除空格後檢查
  const cleanClientId = clientId.trim()
  const cleanClientSecret = clientSecret.trim()
  
  // 測試 Base64 encode（同 Spotify 官方做法）
  let base64Auth = null
  let encodeError = null
  
  try {
    // Node.js Buffer 方法
    const credentials = `${cleanClientId}:${cleanClientSecret}`
    base64Auth = Buffer.from(credentials).toString('base64')
  } catch (err) {
    encodeError = err.message
  }
  
  // 驗證 base64 decode 係咪正確
  let decodeMatch = false
  if (base64Auth) {
    try {
      const decoded = Buffer.from(base64Auth, 'base64').toString('utf8')
      decodeMatch = decoded === `${cleanClientId}:${cleanClientSecret}`
    } catch (err) {
      // ignore
    }
  }
  
  // 檢查係咪新嘅 Credentials（用戶俾嘅）
  const expectedNewId = '9b91df6e49184814a7c6cc6ae3bbaa4c'
  const isNewId = cleanClientId === expectedNewId
  
  res.status(200).json({
    // 原始值（trim 前）
    rawIdPreview,
    rawSecretLength,
    // Trim 後
    clientIdExists: !!cleanClientId,
    clientIdLength: cleanClientId.length,
    clientSecretExists: !!cleanClientSecret,
    secretLength: cleanClientSecret.length,
    // 顯示頭尾幾個字（安全起見）
    clientIdPreview: cleanClientId ? `${cleanClientId.substring(0, 8)}...${cleanClientId.substring(cleanClientId.length - 4)}` : null,
    // 檢查係咪新嘅 Credentials
    isNewCredentials: isNewId,
    expectedIdStart: expectedNewId.substring(0, 8),
    actualIdStart: cleanClientId.substring(0, 8),
    // Base64 測試
    base64AuthPreview: base64Auth ? `${base64Auth.substring(0, 20)}...` : null,
    base64Length: base64Auth ? base64Auth.length : 0,
    encodeError,
    decodeMatch,
    // 比較用戶嘅 credentials 格式
    credentialsFormat: `${cleanClientId.length}:${cleanClientSecret.length}`,
    // 重要提示
    note: isNewId ? '使用新嘅 Credentials' : '仍然使用舊嘅 Credentials！請檢查 Vercel Dashboard Environment Variables'
  })
}
