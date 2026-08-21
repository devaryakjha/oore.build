import { createOoreMswHandlers } from '@oore/client/msw'

export const demoApi = createOoreMswHandlers().pick
