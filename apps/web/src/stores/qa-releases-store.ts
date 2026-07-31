import { create } from 'zustand'

interface QaReleasesStoreState {
  selectedProjectId: string | null
  setSelectedProjectId: (projectId: string) => void
}

export const useQaReleasesStore = create<QaReleasesStoreState>((set) => ({
  selectedProjectId: null,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
}))
