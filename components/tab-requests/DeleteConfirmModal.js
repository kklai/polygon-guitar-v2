export default function DeleteConfirmModal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 pointer-events-auto">
      <div className="bg-[#121212] rounded-3xl p-6 w-full max-w-sm shadow-xl border border-[#282828]">
        <p className="text-white text-center mb-6">確定要刪除這個求譜嗎？此操作無法復原。</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-full bg-[#282828] text-neutral-300 font-medium touch-manipulation"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-full bg-red-500/20 text-red-400 font-medium touch-manipulation"
          >
            確定刪除
          </button>
        </div>
      </div>
    </div>
  )
}
