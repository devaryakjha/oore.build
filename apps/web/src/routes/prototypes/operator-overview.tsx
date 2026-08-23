import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createFileRoute } from '@tanstack/react-router'

import MissionControl from './-operator-overview/mission-control'
import { PrototypeShell } from './-operator-overview/shared'
import TimelineOverview from './-operator-overview/timeline'
import TriageBoard from './-operator-overview/triage-board'

import './-operator-overview/operator-overview.css'

const variants = [
  { name: 'Triage board', Component: TriageBoard },
  { name: 'Mission control', Component: MissionControl },
  { name: 'Timeline', Component: TimelineOverview },
]

export const Route = createFileRoute('/prototypes/operator-overview')({
  component: OperatorOverviewPrototype,
  staticData: {
    breadcrumb: { title: 'Operator overview prototype' },
  },
})

function initialVariant() {
  const value = Number.parseInt(
    new URLSearchParams(window.location.search).get('v') ?? '1',
    10,
  )
  return value >= 1 && value <= variants.length ? value - 1 : 0
}

function OperatorOverviewPrototype() {
  const [current, setCurrent] = useState(initialVariant)
  const [replay, setReplay] = useState(0)
  const pickerRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const CurrentVariant = variants[current].Component

  const moveHighlight = useCallback(() => {
    const item = itemRefs.current[current]
    const highlight = highlightRef.current
    if (!item || !highlight) return
    highlight.style.width = `${item.offsetWidth}px`
    highlight.style.transform = `translateX(${item.offsetLeft}px)`
  }, [current])

  const setActive = useCallback((index: number) => {
    if (index < 0 || index >= variants.length) return
    setCurrent(index)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(null, '', url)
  }, [])

  useLayoutEffect(moveHighlight, [moveHighlight])

  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        pickerRef.current?.setAttribute('data-ready', '')
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [])

  useEffect(() => {
    const onResize = () => moveHighlight()
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= variants.length) {
        setActive(number - 1)
      } else if (event.key === 'ArrowRight') {
        setActive((current + 1) % variants.length)
      } else if (event.key === 'ArrowLeft') {
        setActive((current - 1 + variants.length) % variants.length)
      } else if (event.key === 'r' || event.key === 'R') {
        setReplay((value) => value + 1)
      }
    }

    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [current, moveHighlight, setActive])

  return (
    <PrototypeShell>
      <CurrentVariant key={`${current}-${replay}`} />

      <nav
        ref={pickerRef}
        className="proto-picker"
        aria-label="Prototype variants"
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {variants.map((variant, index) => (
          <button
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            key={variant.name}
            className="proto-picker-item"
            data-active={current === index ? '' : undefined}
            aria-current={current === index ? 'true' : undefined}
            onClick={() => setActive(index)}
          >
            {variant.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setReplay((value) => value + 1)}
        >
          ↻
        </button>
      </nav>
    </PrototypeShell>
  )
}
