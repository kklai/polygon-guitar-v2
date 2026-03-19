/**
 * 與 scripts/create-users-from-pen-names.js 一致：由 penName 算出 placeholder user doc id。
 * 用於樂譜頁在沒有 createdBy 時，連結到「出譜者名稱」對應的 placeholder profile。
 */
import md5 from 'js-md5'

export function getPlaceholderUserId(penName) {
  if (!penName || typeof penName !== 'string') return null
  const trimmed = penName.trim()
  if (!trimmed) return null
  const hash = md5(trimmed).slice(0, 20)
  return `pen-${hash}`
}
