import { useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import NotationToolbar, { TOOL_IDS, DIVISION_IDS } from '@/components/NotationEditor/NotationToolbar'
import StaffCanvas from '@/components/NotationEditor/StaffCanvas'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/**
 * Standalone notation editor: add music notations to tabs.
 * Toolbar: Duration, Division, Beats, Chord name + staff with "+" add slot.
 * To be merged into the tab editor later.
 */
export default function NotationEditorPage() {
  const [selectedDuration, setSelectedDuration] = useState(TOOL_IDS.QUARTER)
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [timeSignatureId, setTimeSignatureId] = useState('4/4')
  const [chordName, setChordName] = useState('')
  const [addedItems, setAddedItems] = useState([])

  const divisionFlags = selectedDivision != null ? { [selectedDivision]: true } : {}

  const onToggleDivision = useCallback((id) => {
    setSelectedDivision((prev) => (prev === id ? null : id))
  }, [])

  const handleAddNotation = () => {
    setAddedItems((prev) => [
      ...prev,
      { duration: selectedDuration, division: { ...divisionFlags }, timeSignatureId, chordName, at: Date.now() }
    ])
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="bg-[#121212] border-b border-neutral-800">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Music notation</h1>
                <p className="text-sm text-[#B3B3B3]">
                  Choose duration, division, beats and chord; then click + on the staff to add
                </p>
              </div>
              <Link
                href="/tabs/new"
                className="p-2 bg-[#282828] hover:bg-[#3E3E3E] text-white rounded-lg flex items-center gap-2"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Editor area: light grey to match design */}
        <div className="max-w-4xl mx-auto bg-neutral-200 rounded-b-xl overflow-hidden shadow-lg">
          <NotationToolbar
            selectedDuration={selectedDuration}
            onSelectDuration={setSelectedDuration}
            divisionFlags={divisionFlags}
            onToggleDivision={onToggleDivision}
            timeSignatureId={timeSignatureId}
            onSelectTimeSignature={setTimeSignatureId}
            chordName={chordName}
            onChordNameChange={setChordName}
          />
          <StaffCanvas
            onAddNotation={handleAddNotation}
            timeSignatureId={timeSignatureId}
            selectedDuration={selectedDuration}
            selectedDivision={selectedDivision}
            onTieApplied={() => setSelectedDivision(null)}
          />
        </div>

        {/* Debug / placeholder feedback (optional, can remove later) */}
        {addedItems.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-xs text-[#B3B3B3]">
              Clicks recorded: {addedItems.length} (duration: {selectedDuration}, chord: {chordName || '—'})
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
