import type { InstanceCredentials } from './types'

const DEFAULT_API_URL = 'https://api.green-api.com'

export function envCredentials(): InstanceCredentials | null {
  const idInstance = (import.meta.env.VITE_GREEN_API_ID_INSTANCE ?? '').trim()
  const apiTokenInstance = (import.meta.env.VITE_GREEN_API_TOKEN ?? '').trim()
  if (!idInstance || !apiTokenInstance) return null

  return {
    apiUrl: (import.meta.env.VITE_GREEN_API_URL ?? DEFAULT_API_URL).trim() || DEFAULT_API_URL,
    idInstance,
    apiTokenInstance,
  }
}
