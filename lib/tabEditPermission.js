/**
 * 出譜者名稱與樂譜 uploaderPenName 一致時，視為可編輯（與 createdBy 並列）。
 */
export function tabUploaderPenNameMatchesUser(tab, penName) {
  const p = (penName || '').trim()
  const u = (tab?.uploaderPenName || '').trim()
  return p.length > 0 && u.length > 0 && p === u
}

/**
 * @param {object} tab - 樂譜文件資料
 * @param {string} userId - 目前登入 uid
 * @param {string} [userPenName] - users/{uid}.penName
 * @param {boolean} isAdmin
 */
export function canUserEditTab(tab, userId, userPenName, isAdmin) {
  if (!tab) return false
  if (isAdmin) return true
  if (userId && tab.createdBy === userId) return true
  if (tabUploaderPenNameMatchesUser(tab, userPenName)) return true
  return false
}
