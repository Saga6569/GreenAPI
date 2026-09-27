import type {
  CheckAccountResponse,
  IncomingNotification,
  InstanceCredentials,
  Message,
  SendMessageResponse,
} from '../types'

const DEFAULT_API_URL = 'https://api.green-api.com'

export function normalizeApiUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_API_URL
}

/** CheckAccount accepts phone digits or @username (Telegram). */
export function normalizeAccountQuery(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('@')) return trimmed.slice(1)
  return trimmed.replace(/\D/g, '')
}

function baseUrl({ apiUrl, idInstance }: InstanceCredentials): string {
  return `${normalizeApiUrl(apiUrl)}/waInstance${idInstance}`
}

// GREEN-API has strict per-method rate limits. Serialize calls and
// space them out a bit to avoid HTTP 429.
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0
const MIN_INTERVAL_MS = 250

async function request<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const task = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequestAt = Date.now()

    const { timeoutMs = 15000, ...rest } = init ?? {}
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(rest.headers ?? {}),
        },
      })

      if (response.status === 204) {
        return null as T
      }

      const text = await response.text()
      const data = text ? (JSON.parse(text) as T) : (null as T)

      if (response.status === 429) {
        throw new Error('HTTP 429 (rate limit)')
      }

      if (!response.ok) {
        const message =
          typeof data === 'object' && data && 'message' in data
            ? String((data as { message?: string }).message)
            : `HTTP ${response.status}`
        throw new Error(message)
      }

      return data
    } finally {
      clearTimeout(timer)
    }
  }) as Promise<T>

  queue = task.catch(() => undefined)
  return task
}

export async function getStateInstance(creds: InstanceCredentials): Promise<{ stateInstance: string }> {
  return request(`${baseUrl(creds)}/getStateInstance/${creds.apiTokenInstance}`)
}

export async function ensureReceiveSettings(creds: InstanceCredentials): Promise<void> {
  await request(`${baseUrl(creds)}/setSettings/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      stateWebhook: 'yes',
    }),
  })
}

export async function checkAccount(
  creds: InstanceCredentials,
  phoneNumber: string,
): Promise<CheckAccountResponse> {
  return request(`${baseUrl(creds)}/checkAccount/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  })
}

export async function sendMessage(
  creds: InstanceCredentials,
  chatId: string,
  message: string,
): Promise<SendMessageResponse> {
  return request(`${baseUrl(creds)}/sendMessage/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({ chatId, message }),
  })
}

export async function receiveNotification(
  creds: InstanceCredentials,
  receiveTimeout = 5,
): Promise<IncomingNotification | null> {
  return request(
    `${baseUrl(creds)}/receiveNotification/${creds.apiTokenInstance}?receiveTimeout=${receiveTimeout}`,
    { timeoutMs: (receiveTimeout + 10) * 1000 },
  )
}

export async function deleteNotification(
  creds: InstanceCredentials,
  receiptId: number,
): Promise<null> {
  return request(`${baseUrl(creds)}/deleteNotification/${creds.apiTokenInstance}/${receiptId}`, {
    method: 'DELETE',
    timeoutMs: 10000,
  })
}

export interface RawChatMessage {
  idMessage: string
  timestamp: number
  typeMessage?: string
  textMessage?: string
  extendedTextMessage?: { text?: string } | string
  type?: string
  chatId?: string
  chatType?: string
  senderId?: string
  senderName?: string
  senderContactName?: string
  textMessageData?: { textMessage: string }
  extendedTextMessageData?: { text: string }
  caption?: string
  statusMessage?: string
}

export async function getChatHistory(
  creds: InstanceCredentials,
  chatId: string,
  count = 50,
): Promise<RawChatMessage[]> {
  return request(`${baseUrl(creds)}/getChatHistory/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({ chatId, count }),
  })
}

export interface RawChatListItem {
  chatId: string
  name: string
  type: string
  phoneNumber?: number | string
  username?: string
}

export async function getChats(creds: InstanceCredentials): Promise<RawChatListItem[]> {
  return request(`${baseUrl(creds)}/getChats/${creds.apiTokenInstance}`)
}

export async function lastIncomingMessages(
  creds: InstanceCredentials,
  count = 20,
): Promise<RawChatMessage[]> {
  return request(`${baseUrl(creds)}/lastIncomingMessages/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  })
}

export async function lastOutgoingMessages(
  creds: InstanceCredentials,
  count = 20,
): Promise<RawChatMessage[]> {
  return request(`${baseUrl(creds)}/lastOutgoingMessages/${creds.apiTokenInstance}`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  })
}

export function mapHistoryMessage(
  raw: RawChatMessage,
  fallbackChatId: string,
): Message | null {
  const extended =
    typeof raw.extendedTextMessage === 'object'
      ? raw.extendedTextMessage?.text
      : raw.extendedTextMessage

  const text =
    raw.textMessageData?.textMessage ??
    raw.extendedTextMessageData?.text ??
    raw.textMessage ??
    extended ??
    raw.caption ??
    ''

  if (!text) return null

  const kind = (raw.type ?? raw.typeMessage ?? '').toLowerCase()
  const isOutgoing = kind === 'outgoing' || kind.includes('outgoing')

  return {
    id: raw.idMessage,
    chatId: raw.chatId || fallbackChatId,
    text,
    timestamp: raw.timestamp,
    isOutgoing,
    senderName: raw.senderName || raw.senderContactName,
    status: 'sent',
  }
}

export function normalizePhoneToChatCandidate(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits
}
