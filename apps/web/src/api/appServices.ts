import { createAppServices } from '@backend/createAppServices'

export const appServices = createAppServices()
export type AppServices = typeof appServices
