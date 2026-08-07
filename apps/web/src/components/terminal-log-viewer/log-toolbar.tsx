import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  Loading03Icon,
  Search01Icon,
  TextWrapIcon,
} from '@hugeicons/core-free-icons'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'

interface LogToolbarProps {
  searchQuery: string
  searchInputRef: RefObject<HTMLInputElement | null>
  matchCount: number
  activeMatchPosition: number
  wrapLines: boolean
  followLive: boolean
  isStreaming: boolean
  onSearchQueryChange: (query: string) => void
  onSearchClear: () => void
  onPreviousMatch: () => void
  onNextMatch: () => void
  onToggleWrap: () => void
  onToggleFollow: () => void
  onCopy: () => void
  onDownload: () => void
}

export function LogToolbar({
  searchQuery,
  searchInputRef,
  matchCount,
  activeMatchPosition,
  wrapLines,
  followLive,
  isStreaming,
  onSearchQueryChange,
  onSearchClear,
  onPreviousMatch,
  onNextMatch,
  onToggleWrap,
  onToggleFollow,
  onCopy,
  onDownload,
}: LogToolbarProps) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
      <InputGroup className="order-first w-full flex-none bg-background sm:order-0 sm:mr-auto sm:w-72">
        <InputGroupInput
          ref={searchInputRef}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search logs"
          aria-label="Search build logs"
          className="font-mono text-xs"
        />
        <InputGroupAddon align="inline-start">
          <HugeiconsIcon icon={Search01Icon} />
        </InputGroupAddon>
        {searchQuery ? (
          <InputGroupAddon align="inline-end" className="gap-0">
            <InputGroupText className="mr-1 font-mono text-[10px] tabular-nums">
              {matchCount === 0
                ? '0 matches'
                : `${activeMatchPosition}/${matchCount}`}
            </InputGroupText>
            <InputGroupButton
              size="icon-xs"
              aria-label="Previous log match"
              disabled={matchCount === 0}
              onClick={onPreviousMatch}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} />
            </InputGroupButton>
            <InputGroupButton
              size="icon-xs"
              aria-label="Next log match"
              disabled={matchCount === 0}
              onClick={onNextMatch}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} />
            </InputGroupButton>
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear log search"
              onClick={onSearchClear}
            >
              <HugeiconsIcon icon={Cancel01Icon} />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <Button
        variant="outline"
        size="sm"
        aria-label="Wrap log lines"
        aria-pressed={wrapLines}
        onClick={onToggleWrap}
      >
        <HugeiconsIcon icon={TextWrapIcon} data-icon="inline-start" />
        Wrap
      </Button>

      {isStreaming ? (
        <Button
          variant="outline"
          size="sm"
          aria-label="Follow live logs"
          aria-pressed={followLive}
          onClick={onToggleFollow}
        >
          <HugeiconsIcon icon={Loading03Icon} data-icon="inline-start" />
          Follow
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        aria-label="Copy logs"
        onClick={onCopy}
      >
        <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
        Copy
      </Button>

      <Button
        variant="outline"
        size="sm"
        aria-label="Download raw logs"
        onClick={onDownload}
      >
        <HugeiconsIcon icon={Download04Icon} data-icon="inline-start" />
        Download
      </Button>
    </div>
  )
}
