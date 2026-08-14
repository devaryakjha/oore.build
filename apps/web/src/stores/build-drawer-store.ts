import { create } from 'zustand'

interface BuildDrawerStoreState {
  open: boolean
  pipelineId?: string
  setOpen: (open: boolean, pipelineId?: string) => void
}

export const useBuildDrawerStore = create<BuildDrawerStoreState>((set) => ({
  open: false,
  setOpen: (open, pipelineId) =>
    set({
      open,
      pipelineId: open ? pipelineId : undefined,
    }),
}))
