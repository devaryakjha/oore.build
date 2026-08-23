import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import BoardOverview from './-project-overview/board'
import PulseOverview from './-project-overview/pulse'
import RunbookOverview from './-project-overview/runbook'
import {
  ProjectPrototypeShell,
  useProjectOverviewDemo,
} from './-project-overview/shared'
import './-project-overview/project-overview.css'

const variants = [
  { name: 'Pulse', component: PulseOverview },
  { name: 'Runbook', component: RunbookOverview },
  { name: 'Board', component: BoardOverview },
] as const

export const Route = createFileRoute('/prototypes/project-overview')({
  component: ProjectOverviewPrototype,
})

function initialVariant() {
  const value = Number.parseInt(
    new URLSearchParams(window.location.search).get('v') ?? '1',
    10,
  )
  return Number.isInteger(value) && value >= 1 && value <= variants.length
    ? value - 1
    : 0
}

function ProjectOverviewPrototype() {
  const [current, setCurrent] = useState(initialVariant)
  const [replayKey, setReplayKey] = useState(0)
  const pickerRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const highlightRef = useRef<HTMLSpanElement>(null)
  const demo = useProjectOverviewDemo()
  const Variant = variants[current].component

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
    setReplayKey((value) => value + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(null, '', url)
  }, [])

  useLayoutEffect(() => {
    moveHighlight()
    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        pickerRef.current?.setAttribute('data-ready', '')
      })
      return () => cancelAnimationFrame(secondFrame)
    })

    const onResize = () => moveHighlight()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(firstFrame)
      window.removeEventListener('resize', onResize)
    }
  }, [moveHighlight])

  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        (target instanceof HTMLElement &&
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) ||
        (target instanceof HTMLElement && target.isContentEditable)
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
        setReplayKey((value) => value + 1)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [current, setActive])

  const variantProps = {
    data: demo.data,
    queued: demo.queued,
    onRunBuild: () => demo.runBuild(),
    onOpenAction: (label: string) => demo.openAction(label),
    onInstall: () => demo.install(),
    onCopyLink: () => demo.copyLink(),
    onShare: () => demo.share(),
  }

  return (
    <>
      <ProjectPrototypeShell
        data={demo.data}
        notice={demo.notice}
        queued={demo.queued}
        scenario={demo.scenario}
        onScenarioChange={(scenario) => demo.selectScenario(scenario)}
        onRunBuild={() => demo.runBuild()}
        onOpenPeer={(label) => demo.openPeer(label)}
      >
        <Variant key={`${current}-${replayKey}`} {...variantProps} />
      </ProjectPrototypeShell>

      <nav
        ref={pickerRef}
        className="proto-picker"
        aria-label="Prototype variants"
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        ></span>
        {variants.map((variant, index) => (
          <button
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            type="button"
            key={variant.name}
            className="proto-picker-item"
            data-active={current === index ? '' : undefined}
            aria-current={current === index ? 'true' : undefined}
            onClick={() => setActive(index)}
          >
            {variant.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true"></span>
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setReplayKey((value) => value + 1)}
        >
          ↻
        </button>
      </nav>
    </>
  )
}
