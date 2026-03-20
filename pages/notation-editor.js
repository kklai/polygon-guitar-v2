import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import NotationToolbar, { TOOL_IDS } from '@/components/NotationEditor/NotationToolbar'
import StaffCanvas from '@/components/NotationEditor/StaffCanvas'
import { notationSnapshotToAlphaTex } from '@/lib/notationToAlphaTex'
import {
  readNotationEditorState,
  writeNotationEditorState,
  clearNotationEditorState,
} from '@/lib/notationEditorStorage'
import {
  setPendingNotationTex,
  consumeNotationReturnPath,
  getNotationEditorReturnPath,
} from '@/lib/notationEditorBridge'
import { ArrowLeft, Eraser, Save } from 'lucide-react'
import Link from 'next/link'

const NotationAlphaTabPreview = dynamic(
  () => import('@/components/NotationEditor/NotationAlphaTabPreview'),
  { ssr: false }
)

/**
 * Standalone notation editor: add music notations to tabs.
 * Toolbar: Duration, Division, Beats + staff with "+" add slot.
 * To be merged into the tab editor later.
 */
function restoreWindowScroll(x, y) {
  window.scrollTo({ left: x, top: y, behavior: 'auto' })
}

const DEFAULT_STAFF_SNAPSHOT = Object.freeze({
  firstBeats: [{ duration: 'quarter' }],
  subdivisions: [],
})

export default function NotationEditorPage() {
  const router = useRouter()
  const staffRef = useRef(null)
  /** After save, keep viewport from jumping when preview mounts / alphaTab lays out */
  const scrollAfterSaveRef = useRef(null)
  const [selectedDuration, setSelectedDuration] = useState(TOOL_IDS.QUARTER)
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [timeSignatureId, setTimeSignatureId] = useState('4/4')
  const [savedAlphaTex, setSavedAlphaTex] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [editorHydrated, setEditorHydrated] = useState(false)
  const [staffCanvasKey, setStaffCanvasKey] = useState(0)
  const [staffBootstrap, setStaffBootstrap] = useState(() => ({
    firstBeats: [...DEFAULT_STAFF_SNAPSHOT.firstBeats],
    subdivisions: [...DEFAULT_STAFF_SNAPSHOT.subdivisions],
  }))
  const [persistStaffRev, setPersistStaffRev] = useState(0)
  const [backHref, setBackHref] = useState('/tabs/new')

  const staffBootstrapMemo = useMemo(
    () => ({
      firstBeats: JSON.parse(JSON.stringify(staffBootstrap.firstBeats)),
      subdivisions: JSON.parse(JSON.stringify(staffBootstrap.subdivisions)),
    }),
    [staffBootstrap]
  )

  useEffect(() => {
    const p = getNotationEditorReturnPath()
    if (p) setBackHref(p)
  }, [])

  useEffect(() => {
    const d = readNotationEditorState()
    if (d) {
      setTimeSignatureId(d.timeSignatureId ?? '4/4')
      setSelectedDuration(d.selectedDuration ?? TOOL_IDS.QUARTER)
      setSelectedDivision(d.selectedDivision ?? null)
      setSavedAlphaTex(d.savedAlphaTex ?? null)
      if (d.staff?.firstBeats?.length) {
        setStaffBootstrap({
          firstBeats: d.staff.firstBeats,
          subdivisions: Array.isArray(d.staff.subdivisions) ? d.staff.subdivisions : [],
        })
        setStaffCanvasKey((k) => k + 1)
      }
    }
    setEditorHydrated(true)
  }, [])

  const bumpPersistStaff = useCallback(() => {
    setPersistStaffRev((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!editorHydrated) return undefined
    const t = setTimeout(() => {
      const staff = staffRef.current?.getSnapshot?.()
      if (!staff) return
      writeNotationEditorState({
        timeSignatureId,
        selectedDuration,
        selectedDivision,
        staff,
        savedAlphaTex,
      })
    }, 450)
    return () => clearTimeout(t)
  }, [
    editorHydrated,
    timeSignatureId,
    selectedDuration,
    selectedDivision,
    savedAlphaTex,
    persistStaffRev,
  ])

  const divisionFlags = selectedDivision != null ? { [selectedDivision]: true } : {}

  const onToggleDivision = useCallback((id) => {
    setSelectedDivision((prev) => (prev === id ? null : id))
  }, [])

  const onBeatFocus = useCallback(({ duration, dotted, tuplet }) => {
    setSelectedDuration(duration)
    setSelectedDivision(tuplet ? 'tuplet' : dotted ? 'dotted' : null)
  }, [])

  const handleClearDraft = () => {
    clearNotationEditorState()
    setTimeSignatureId('4/4')
    setSelectedDuration(TOOL_IDS.QUARTER)
    setSelectedDivision(null)
    setSavedAlphaTex(null)
    setSaveError(null)
    setStaffBootstrap({
      firstBeats: [...DEFAULT_STAFF_SNAPSHOT.firstBeats.map((b) => ({ ...b }))],
      subdivisions: [],
    })
    setStaffCanvasKey((k) => k + 1)
  }

  const handleSave = () => {
    const sx = typeof window !== 'undefined' ? window.scrollX : 0
    const sy = typeof window !== 'undefined' ? window.scrollY : 0
    scrollAfterSaveRef.current = { x: sx, y: sy }

    setSaveError(null)
    try {
      const snap = staffRef.current?.getSnapshot?.()
      if (!snap) {
        setSaveError('Staff is not ready.')
        scrollAfterSaveRef.current = null
        return
      }
      const tex = notationSnapshotToAlphaTex({
        ...snap,
        timeSignatureId,
      })
      setSavedAlphaTex(tex)
      setPendingNotationTex(tex)
      const returnPath = consumeNotationReturnPath()
      if (returnPath) {
        queueMicrotask(() => {
          const staff = staffRef.current?.getSnapshot?.()
          if (staff) {
            writeNotationEditorState({
              timeSignatureId,
              selectedDuration,
              selectedDivision,
              staff,
              savedAlphaTex: tex,
            })
          }
        })
        router.push(returnPath)
        scrollAfterSaveRef.current = null
        return
      }

      queueMicrotask(() => {
        const staff = staffRef.current?.getSnapshot?.()
        if (staff) {
          writeNotationEditorState({
            timeSignatureId,
            selectedDuration,
            selectedDivision,
            staff,
            savedAlphaTex: tex,
          })
        }
      })

      // Restore immediately and again after layout + alphaTab async render (no scroll chaining)
      queueMicrotask(() => restoreWindowScroll(sx, sy))
      requestAnimationFrame(() => {
        restoreWindowScroll(sx, sy)
        requestAnimationFrame(() => restoreWindowScroll(sx, sy))
      })
      ;[0, 50, 150, 350, 600].forEach((ms) => {
        setTimeout(() => {
          const pos = scrollAfterSaveRef.current
          if (!pos) return
          restoreWindowScroll(pos.x, pos.y)
        }, ms)
      })
      setTimeout(() => {
        scrollAfterSaveRef.current = null
      }, 650)
    } catch (e) {
      setSaveError(e?.message || 'Failed to build alphaTex')
      scrollAfterSaveRef.current = null
    }
  }

  useEffect(() => {
    if (!savedAlphaTex || !scrollAfterSaveRef.current) return
    const { x, y } = scrollAfterSaveRef.current
    restoreWindowScroll(x, y)
  }, [savedAlphaTex])

  return (
    <Layout>
      <div className="min-h-screen bg-black" style={{ overflowAnchor: 'none' }}>
        {/* Header — title matches Preview bar (`NotationAlphaTabPreview`) */}
        <div className="bg-[#121212] border-b border-neutral-800">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white">Editor</h2>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="px-4 py-2 bg-[#282828] hover:bg-[#3E3E3E] text-white font-semibold rounded-lg flex items-center gap-2 text-sm border border-neutral-600"
                  title="Clear saved draft from this device"
                >
                  <Eraser className="w-4 h-4" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#FFD700] hover:bg-yellow-400 text-black font-semibold rounded-lg flex items-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <Link
                  href={backHref}
                  className="p-2 bg-[#282828] hover:bg-[#3E3E3E] text-white rounded-lg flex items-center gap-2"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="max-w-4xl mx-auto px-4 pt-2">
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        {/* Editor area: light grey to match design */}
        <div className="max-w-4xl mx-auto bg-neutral-200 rounded-b-xl overflow-hidden shadow-lg">
          <NotationToolbar
            selectedDuration={selectedDuration}
            onSelectDuration={setSelectedDuration}
            divisionFlags={divisionFlags}
            onToggleDivision={onToggleDivision}
            timeSignatureId={timeSignatureId}
            onSelectTimeSignature={setTimeSignatureId}
          />
          {editorHydrated ? (
            <StaffCanvas
              key={staffCanvasKey}
              ref={staffRef}
              initialStaffSnapshot={staffBootstrapMemo}
              timeSignatureId={timeSignatureId}
              selectedDuration={selectedDuration}
              selectedDivision={selectedDivision}
              onTieApplied={() => setSelectedDivision(null)}
              onBeatFocus={onBeatFocus}
              onStaffStructureChange={bumpPersistStaff}
            />
          ) : (
            <div className="min-h-[200px] flex items-center justify-center text-neutral-500 text-sm">
              Loading editor…
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto pb-8">
          {savedAlphaTex && <NotationAlphaTabPreview alphaTex={savedAlphaTex} />}
        </div>
      </div>
    </Layout>
  )
}
