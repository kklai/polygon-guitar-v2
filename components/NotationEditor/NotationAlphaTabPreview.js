import { useCallback, useEffect, useRef, useState } from 'react'

/** Bundled with @coderline/alphatab — avoids requiring public/soundfonts (see TABLATURE_SETUP.md). */
const ALPHATAB_SOUNDFONT =
  'https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.1/dist/soundfont/sonivox.sf2'

function formatAlphaTabLoadError(e) {
  const out = []
  const walk = (err) => {
    if (!err || typeof err !== 'object') return
    if (err.message) out.push(err.message)
    for (const key of ['lexerDiagnostics', 'parserDiagnostics', 'semanticDiagnostics']) {
      const bag = err[key]
      if (bag && typeof bag[Symbol.iterator] === 'function') {
        for (const d of bag) {
          if (d?.message) out.push(d.message)
        }
      }
    }
    if (err.inner) walk(err.inner)
  }
  walk(e)
  const uniq = [...new Set(out.filter(Boolean))]
  return uniq.length ? uniq.join(' — ') : String(e)
}

/** Dark-mode alphaTab: all notation + text light (see display.resources in alphaTab docs). */
const COLORS = {
  backgroundColor: '#1a1a1a',
  // Core (defaults are black / gray — these fix “invisible” glyphs on dark bg)
  mainGlyphColor: '#FFFFFF', // primary voice: rests, TAB label, time sig, SMuFL symbols
  scoreInfoColor: '#FFFFFF', // score header text (tuning hidden via notation.elements)
  secondaryGlyphColor: '#FFFFFF', // secondary voices (default is translucent black)
  staffLineColor: '#FFFFFF',
  barSeparatorColor: '#FFFFFF',
  barNumberColor: '#FFFFFF',
  // Web/legacy keys still applied by the runtime for tab-specific painting
  fretNumberColor: '#FFFFFF',
  chordNameColor: '#FFFFFF',
  timeSignatureColor: '#FFFFFF',
  tabTuningTextColor: '#FFFFFF',
}

/**
 * The “TAB” label at the start is the SMuFL tab-clef glyph — hide it per bar via stylesheet colors.
 * (alphaTab has no separate toggle for the label only; layout still reserves clef width.)
 */
function hideGuitarTabClefGlyph(score, AlphaTabModule) {
  const modelNs = AlphaTabModule?.model
  if (!score?.tracks || !modelNs?.BarStyle || !modelNs?.BarSubElement || !modelNs?.Color) return

  const transparent = new modelNs.Color(0, 0, 0, 0)
  const clefKey = modelNs.BarSubElement.GuitarTabsClef

  for (const track of score.tracks) {
    if (!track?.staves) continue
    for (const staff of track.staves) {
      if (!staff?.bars) continue
      for (const bar of staff.bars) {
        if (!bar.style) bar.style = new modelNs.BarStyle()
        bar.style.colors.set(clefKey, transparent)
      }
    }
  }
}

/** Reposition & style the built-in “rendered by alphaTab” credit (no API to disable). */
function styleAlphaTabWatermark(container) {
  if (!container) return

  const apply = () => {
    container.querySelectorAll('text').forEach((textEl) => {
      const raw = (textEl.textContent || '').trim().toLowerCase()
      if (!raw.includes('alphatab') && !raw.includes('rendered')) return

      textEl.style.font = 'normal 12px Arial, sans-serif'
      textEl.style.opacity = '0.5'
      textEl.setAttribute('font-weight', 'normal')

      const svg = textEl.closest('svg')
      const wrapper = svg?.parentElement
      if (!wrapper || !container.contains(wrapper)) return

      Object.assign(wrapper.style, {
        position: 'absolute',
        left: 'auto',
        top: 'auto',
        right: '12px',
        bottom: '12px',
        width: 'auto',
        height: 'auto',
        zIndex: '10',
        display: 'inline-block',
        maxWidth: 'calc(100% - 24px)',
      })

      if (svg) {
        svg.style.overflow = 'visible'
        try {
          const bb = textEl.getBBox()
          const pad = 4
          const w = Math.ceil(bb.width + pad * 2)
          const h = Math.ceil(bb.height + pad * 2)
          svg.setAttribute('width', String(w))
          svg.setAttribute('height', String(h))
          textEl.setAttribute('x', String(w - pad))
          textEl.setAttribute('y', String(pad))
          textEl.setAttribute('text-anchor', 'end')
          textEl.setAttribute('dominant-baseline', 'hanging')
        } catch (_) {
          /* getBBox can fail if svg not laid out */
        }
      }
    })
  }

  apply()
  requestAnimationFrame(apply)
}

/**
 * Renders alphaTex with dynamically imported @coderline/alphatab (no SSR bundle bloat).
 */
/** alphaTab `currentTime` / `endTime` / `api.endTime` are in milliseconds — no fractional seconds in the label. */
function formatPlaybackTimeMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '00:00'
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function NotationAlphaTabPreview({ alphaTex, onError }) {
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const [loadError, setLoadError] = useState(null)
  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!alphaTex?.trim() || !containerRef.current) return undefined

    let cancelled = false

    const run = async () => {
      setLoadError(null)
      setReady(false)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      try {
        const AlphaTab = await import('@coderline/alphatab')
        if (cancelled || !containerRef.current) return

        if (apiRef.current) {
          try {
            apiRef.current.destroy()
          } catch (_) {
            /* ignore */
          }
          apiRef.current = null
        }
        containerRef.current.innerHTML = ''

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
        const width = containerRef.current.clientWidth || 800

        const api = new AlphaTab.AlphaTabApi(containerRef.current, {
          core: {
            engine: 'svg',
            useWorkers: false,
            fontDirectory: '/fonts/',
            logLevel: 'warning',
          },
          display: {
            staveProfile: 'Tab',
            scale: isMobile ? 0.75 : 1,
            width,
            // [left-right, top-bottom] — default is [35, 35]; remove horizontal inset around the score
            padding: [0, 35],
            resources: {
              mainGlyphColor: COLORS.mainGlyphColor,
              scoreInfoColor: COLORS.scoreInfoColor,
              secondaryGlyphColor: COLORS.secondaryGlyphColor,
              barNumberColor: COLORS.barNumberColor,
              staffLineColor: COLORS.staffLineColor,
              barSeparatorColor: COLORS.barSeparatorColor,
              fretNumberColor: COLORS.fretNumberColor,
              chordNameColor: COLORS.chordNameColor,
              timeSignatureColor: COLORS.timeSignatureColor,
              tabTuningTextColor: COLORS.tabTuningTextColor,
              tablatureFont: '14px Arial, sans-serif',
            },
          },
          notation: {
            elements: {
              scoreTitle: false,
              scoreSubTitle: false,
              scoreArtist: false,
              scoreAlbum: false,
              guitarTuning: false, // hide “Guitar Standard Tuning” (NotationElement.GuitarTuning)
              effectTempo: false,
              effectDynamics: false, // hide f (forte), p, mf, etc. (NotationElement.EffectDynamics)
              effectBeatTimer: false, // hide per-beat timer text on score (we use one control-bar timer)
              trackNames: false,
            },
          },
          player: {
            enablePlayer: true,
            enableCursor: true,
            enableUserInteraction: true,
            enableElementHighlighting: true,
            scrollMode: 'Off',
            soundFont: ALPHATAB_SOUNDFONT,
          },
        })

        apiRef.current = api

        const onScoreErr = (e) => {
          setLoadError(formatAlphaTabLoadError(e))
          onError?.(e)
        }
        api.error.on(onScoreErr)
        api.playerStateChanged.on((arg) => {
          if (cancelled) return
          const state = typeof arg === 'string' ? arg : arg?.state
          setIsPlaying(state === 'playing')
        })
        api.playerPositionChanged.on((e) => {
          if (cancelled) return
          setCurrentTime(e?.currentTime ?? 0)
          const end = e?.endTime
          if (typeof end === 'number' && end > 0) {
            setDuration(end)
          }
        })
        api.scoreLoaded.on((score) => {
          if (score?.stylesheet) {
            score.stylesheet.globalDisplayTuning = false
          }
          hideGuitarTabClefGlyph(score, AlphaTab)
          // Total length is in ms on the API (`score.duration` is not reliable); `endTime` fills after tick lookup.
          if (!cancelled) {
            const endMs = api.endTime
            if (typeof endMs === 'number' && endMs > 0) {
              setDuration(endMs)
            }
          }
          try {
            api.render()
          } catch (_) {
            /* ignore */
          }
          if (!cancelled) setReady(true)
          // `endTime` is sometimes 0 until after render/tick build — pick it up on the next tick.
          if (!cancelled) {
            queueMicrotask(() => {
              if (cancelled) return
              const t = api.endTime
              if (typeof t === 'number' && t > 0) setDuration(t)
            })
          }
        })
        api.renderFinished.on(() => {
          if (cancelled || !containerRef.current) return
          requestAnimationFrame(() => styleAlphaTabWatermark(containerRef.current))
        })

        try {
          api.tex(alphaTex)
        } catch (texErr) {
          if (!cancelled) setLoadError(formatAlphaTabLoadError(texErr))
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || String(err)
          setLoadError(msg)
          onError?.(err)
        }
      }
    }

    run()

    return () => {
      cancelled = true
      if (apiRef.current) {
        try {
          apiRef.current.stop?.()
        } catch (_) {
          /* ignore */
        }
        try {
          apiRef.current.destroy()
        } catch (_) {
          /* ignore */
        }
        apiRef.current = null
      }
    }
  }, [alphaTex])

  const handlePlayPause = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    try {
      if (isPlaying) api.pause()
      else api.play()
    } catch (_) {
      /* ignore */
    }
  }, [isPlaying])

  const handleStop = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    try {
      api.stop()
    } catch (_) {
      /* ignore */
    }
  }, [])

  const handleSpeedChange = useCallback((speed) => {
    const api = apiRef.current
    if (api) api.playbackSpeed = speed
  }, [])

  if (!alphaTex?.trim()) return null

  return (
    <div className="notation-alphatab-preview rounded-xl border border-neutral-800 overflow-hidden bg-[#121212]">
      {ready && !loadError && (
        <div
          className="py-2 border-b border-neutral-800 px-4 flex flex-wrap items-center justify-end gap-3"
          style={{ backgroundColor: COLORS.backgroundColor }}
        >
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePlayPause}
                className="bg-[#FFD700] hover:bg-yellow-400 rounded-full flex items-center justify-center text-black transition shrink-0"
                style={{ width: '1.4rem', height: '1.4rem' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 ml-px" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="w-8 h-8 hover:bg-neutral-700 rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition shrink-0"
                aria-label="Stop"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>
            </div>
            <span
              className="text-xs text-neutral-300 tabular-nums shrink-0"
              title="Elapsed / duration"
            >
              {formatPlaybackTimeMs(currentTime)} / {formatPlaybackTimeMs(duration)}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-neutral-400 shrink-0">
              <span className="hidden sm:inline">Speed</span>
              <select
                defaultValue="1"
                onChange={(e) => handleSpeedChange(Number.parseFloat(e.target.value) || 1)}
                className="bg-black border border-neutral-700 rounded px-2 py-1 text-xs text-white max-w-[4.5rem]"
              >
                <option value="0.5">0.5×</option>
                <option value="0.75">0.75×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </label>
          </div>
        </div>
      )}
      {loadError && (
        <div className="py-3 text-sm text-red-400 bg-red-950/40 px-0">{loadError}</div>
      )}
      <div
        className="relative w-full min-h-[220px] p-4"
        style={{ backgroundColor: COLORS.backgroundColor }}
      >
        {!ready && !loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-[#B3B3B3] text-sm bg-[#121212]/90">
            Loading alphaTab…
          </div>
        )}
        <div ref={containerRef} className="relative w-full min-h-[200px] notation-alphatab-host" />
      </div>
    </div>
  )
}
