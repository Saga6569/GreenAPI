import { useCallback, useEffect, useRef, useState } from 'react'
import { envCredentials } from '../env'
import {
  checkAccount,
  deleteNotification,
  ensureReceiveSettings,
  getChatHistory,
  getChats,
  getStateInstance,
  lastIncomingMessages,
  lastOutgoingMessages,
  mapHistoryMessage,
  normalizeAccountQuery,
  normalizeApiUrl,
  receiveNotification,
  sendMessage as apiSendMessage,
} from '../api/greenApi'
import type {
  Chat,
  InstanceCredentials,
  Message,
} from '../types'

const STORAGE_KEY = 'greenapi-telegram-chat'

interface StoredState {
  creds: InstanceCredentials
  chats: Chat[]
  messagesByChat: Record<string, Message[]>
}

function loadStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredState
  } catch {
    return null
  }
}

function sameCreds(a?: InstanceCredentials | null, b?: InstanceCredentials | null): boolean {
  if (!a || !b) return false
  return (
    a.idInstance === b.idInstance &&
    a.apiTokenInstance === b.apiTokenInstance &&
    (a.apiUrl || '') === (b.apiUrl || '')
  )
}

function persist(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useMessenger() {
  const [initial] = useState(() => {
    const stored = loadStored()
    // Prefer .env credentials when they differ from a previous session
    // (e.g. leftover demo data in localStorage).
    if (envCredentials() && (!stored?.creds || !sameCreds(stored.creds, envCredentials()))) {
      return null
    }
    return stored
  })
  const [creds, setCreds] = useState<InstanceCredentials | null>(initial?.creds ?? null)
  const [chats, setChats] = useState<Chat[]>(initial?.chats ?? [])
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>(
    initial?.messagesByChat ?? {},
  )
  const [activeChatId, setActiveChatId] = useState<string | null>(initial?.chats[0]?.chatId ?? null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'online' | 'error'>(
    initial?.creds ? 'online' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)

  const credsRef = useRef(creds)
  const pollingRef = useRef(false)

  useEffect(() => {
    credsRef.current = creds
  }, [creds])

  useEffect(() => {
    if (creds) {
      persist({ creds, chats, messagesByChat })
    }
  }, [creds, chats, messagesByChat])

  const upsertChat = useCallback((chat: Chat) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.chatId === chat.chatId)
      if (idx === -1) return [chat, ...prev]
      const next = [...prev]
      const existing = next[idx]
      next[idx] = {
        ...existing,
        ...chat,
        // don't overwrite a real contact name with a raw chatId
        name:
          !chat.name || chat.name === chat.chatId
            ? existing.name
            : chat.name,
        lastMessage: chat.lastMessage ?? existing.lastMessage,
        lastMessageAt: chat.lastMessageAt ?? existing.lastMessageAt,
      }
      return next
    })
  }, [])

  const appendMessage = useCallback((message: Message) => {
    setMessagesByChat((prev) => {
      const list = prev[message.chatId] ?? []
      if (list.some((m) => m.id === message.id)) return prev
      return {
        ...prev,
        [message.chatId]: [...list, message],
      }
    })

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.chatId === message.chatId)
      if (idx === -1) {
        return [
          {
            chatId: message.chatId,
            name: message.senderName || message.chatId,
            chatType: 'user',
            lastMessage: message.text,
            lastMessageAt: message.timestamp,
          },
          ...prev,
        ]
      }
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        lastMessage: message.text,
        lastMessageAt: message.timestamp,
      }
      const [item] = next.splice(idx, 1)
      return [item, ...next]
    })
  }, [])

  const updateMessageStatus = useCallback((chatId: string, id: string, status: Message['status']) => {
    setMessagesByChat((prev) => {
      const list = prev[chatId] ?? []
      return {
        ...prev,
        [chatId]: list.map((m) => (m.id === id ? { ...m, status } : m)),
      }
    })
  }, [])

  const login = useCallback(async (input: InstanceCredentials) => {
    setConnectionState('connecting')
    setError(null)
    const normalized: InstanceCredentials = {
      ...input,
      apiUrl: normalizeApiUrl(input.apiUrl),
    }
    try {
      const state = await getStateInstance(normalized)
      if (state.stateInstance !== 'authorized') {
        throw new Error(
          `Инстанс не авторизован (stateInstance: ${state.stateInstance}). Авторизуйте инстанс в личном кабинете GREEN-API.`,
        )
      }
      // Enable HTTP API notifications (webhookUrl empty + incoming/outgoing webhooks)
      await ensureReceiveSettings(normalized).catch((e) => {
        console.warn('setSettings failed', e)
      })
      setCreds(normalized)
      setConnectionState('online')
      return true
    } catch (e) {
      setConnectionState('error')
      setError(e instanceof Error ? e.message : 'Не удалось подключиться к GREEN-API')
      return false
    }
  }, [])

  const logout = useCallback(() => {
    pollingRef.current = false
    setCreds(null)
    setConnectionState('idle')
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const loadHistory = useCallback(
    async (chatId: string) => {
      if (!credsRef.current) return
      try {
        const raw = await getChatHistory(credsRef.current, chatId, 50)
        const mapped = raw
          .map((item) => mapHistoryMessage(item, chatId))
          .filter((m): m is Message => m !== null)
          .reverse()

        setMessagesByChat((prev) => {
          const existing = prev[chatId] ?? []
          const ids = new Set(existing.map((m) => m.id))
          const merged = [...mapped.filter((m) => !ids.has(m.id)), ...existing]
          merged.sort((a, b) => a.timestamp - b.timestamp)
          return { ...prev, [chatId]: merged }
        })
      } catch (e) {
        console.warn('getChatHistory failed', e)
      }
    },
    [],
  )

  const loadChatList = useCallback(async () => {
    if (!credsRef.current) return
    try {
      const items = await getChats(credsRef.current)
      const mapped: Chat[] = items.map((item) => ({
        chatId: item.chatId,
        name: item.name || item.username || item.chatId,
        chatType:
          item.type === 'supergroup' || item.type === 'group' || item.type === 'channel'
            ? 'group'
            : 'user',
        phoneNumber: item.phoneNumber ? String(item.phoneNumber) : undefined,
      }))
      setChats((prev) => {
        const byId = new Map(mapped.map((c) => [c.chatId, c]))
        for (const c of prev) {
          if (!byId.has(c.chatId)) byId.set(c.chatId, c)
          else {
            const found = byId.get(c.chatId)!
            byId.set(c.chatId, { ...found, lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt })
          }
        }
        return [...byId.values()]
      })
    } catch (e) {
      console.warn('getChats failed', e)
    }
  }, [])

  const syncFromJournals = useCallback(async () => {
    if (!credsRef.current) return
    try {
      const [incoming, outgoing] = await Promise.all([
        lastIncomingMessages(credsRef.current, 30).catch(() => []),
        lastOutgoingMessages(credsRef.current, 30).catch(() => []),
      ])
      const all = [...incoming, ...outgoing]
      const chatsToUpsert = new Map<string, Chat>()
      const messages: Message[] = []

      for (const raw of all) {
        const chatId = raw.chatId
        if (!chatId) continue
        const msg = mapHistoryMessage(raw, chatId)
        if (!msg) continue
        messages.push(msg)

        if (!chatsToUpsert.has(chatId)) {
          chatsToUpsert.set(chatId, {
            chatId,
            name: raw.senderName || raw.senderContactName || chatId,
            chatType: raw.chatType === 'user' || raw.chatType === 'bot' ? 'user' : 'group',
          })
        }
      }

      for (const chat of chatsToUpsert.values()) {
        upsertChat(chat)
      }

      setMessagesByChat((prev) => {
        const next = { ...prev }
        for (const msg of messages) {
          const list = next[msg.chatId] ?? []
          if (list.some((m) => m.id === msg.id)) continue
          const merged = [...list, msg]
          merged.sort((a, b) => a.timestamp - b.timestamp)
          next[msg.chatId] = merged
        }
        return next
      })

      // update last message previews
      setChats((prev) => {
        const lastByChat = new Map<string, Message>()
        for (const msg of messages) {
          const cur = lastByChat.get(msg.chatId)
          if (!cur || msg.timestamp > cur.timestamp) lastByChat.set(msg.chatId, msg)
        }
        return prev.map((c) => {
          const last = lastByChat.get(c.chatId)
          if (!last || (c.lastMessageAt && c.lastMessageAt >= last.timestamp)) return c
          return { ...c, lastMessage: last.text, lastMessageAt: last.timestamp }
        })
      })
    } catch (e) {
      console.warn('journal sync failed', e)
    }
  }, [upsertChat])

  const createChatByPhone = useCallback(
    async (phone: string, displayName?: string) => {
      if (!credsRef.current) throw new Error('Нет подключения')
      const query = normalizeAccountQuery(phone)
      const isUsername = phone.trim().startsWith('@')
      if (!isUsername && query.length < 10) {
        throw new Error('Введите номер телефона с кодом страны или @username')
      }
      if (isUsername && query.length < 3) {
        throw new Error('Введите корректный @username')
      }

      let chatId = isUsername ? query : query
      try {
        const result = await checkAccount(credsRef.current, query)
        if (result.exist && result.chatId) {
          chatId = result.chatId
        } else if (!result.exist) {
          throw new Error(
            isUsername
              ? 'Аккаунт Telegram не найден по этому @username'
              : 'Аккаунт не найден по этому номеру',
          )
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('не найден')) throw e
        if (isUsername) throw e
        // Fallback: phone@c.us form used by GREEN-API
        chatId = `${query}@c.us`
      }

      const chat: Chat = {
        chatId,
        name: displayName?.trim() || phone.trim() || chatId,
        chatType: 'user',
        phoneNumber: isUsername ? undefined : query,
      }
      upsertChat(chat)
      setActiveChatId(chatId)
      void loadHistory(chatId)
      return chat
    },
    [loadHistory, upsertChat],
  )

  const sendText = useCallback(
    async (chatId: string, text: string) => {
      if (!credsRef.current) throw new Error('Нет подключения')
      const trimmed = text.trim()
      if (!trimmed) return

      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const optimistic: Message = {
        id: localId,
        chatId,
        text: trimmed,
        timestamp: Math.floor(Date.now() / 1000),
        isOutgoing: true,
        status: 'sending',
      }
      appendMessage(optimistic)

      try {
        const result = await apiSendMessage(credsRef.current, chatId, trimmed)
        setMessagesByChat((prev) => {
          const list = (prev[chatId] ?? []).filter((m) => m.id !== localId)
          return {
            ...prev,
            [chatId]: [
              ...list,
              {
                ...optimistic,
                id: result.idMessage || localId,
                status: 'sent',
              },
            ],
          }
        })
      } catch (e) {
        updateMessageStatus(chatId, localId, 'failed')
        throw e
      }
    },
    [appendMessage, updateMessageStatus],
  )

  // Fallback: poll message journals so incoming messages appear even if
  // ReceiveNotification/webhooks are delayed or disabled.
  useEffect(() => {
    if (!creds) return
    void loadChatList()
    void syncFromJournals()
    const timer = setInterval(() => {
      void syncFromJournals()
    }, 20000)
    return () => clearInterval(timer)
  }, [creds, loadChatList, syncFromJournals])

  // Long-polling receive loop
  useEffect(() => {
    if (!creds) return

    let cancelled = false
    pollingRef.current = true

    const handleNotification = async (note: NonNullable<Awaited<ReturnType<typeof receiveNotification>>>) => {
      const body = note.body
      const type = body.typeWebhook

      try {
        if (type === 'incomingMessageReceived') {
          const chatId = body.senderData?.chatId
          const text =
            body.messageData?.textMessageData?.textMessage ??
            body.messageData?.extendedTextMessageData?.text ??
            ''

          if (chatId && text) {
            const name =
              body.senderData?.senderContactName ||
              body.senderData?.senderName ||
              body.senderData?.chatName ||
              chatId

            upsertChat({
              chatId,
              name,
              chatType: body.senderData?.chatType === 'group' ? 'group' : 'user',
              phoneNumber:
                body.senderData?.senderPhoneNumber != null
                  ? String(body.senderData.senderPhoneNumber)
                  : undefined,
            })

            appendMessage({
              id: body.idMessage,
              chatId,
              text,
              timestamp: body.timestamp,
              isOutgoing: false,
              senderName: body.senderData?.senderName,
              status: 'sent',
            })
          }
        } else if (type === 'outgoingMessageReceived' || type === 'outgoingAPIMessageReceived') {
          const chatId = body.senderData?.chatId
          const text =
            body.messageData?.textMessageData?.textMessage ??
            body.messageData?.extendedTextMessageData?.text ??
            ''
          if (chatId && text) {
            appendMessage({
              id: body.idMessage,
              chatId,
              text,
              timestamp: body.timestamp,
              isOutgoing: true,
              status: 'sent',
            })
          }
        } else if (type === 'outgoingMessageStatus') {
          // optional: could update delivery status
        }
      } finally {
        await deleteNotification(credsRef.current!, note.receiptId).catch(() => undefined)
      }
    }

    const loop = async () => {
      while (!cancelled && pollingRef.current && credsRef.current) {
        try {
          const note = await receiveNotification(credsRef.current, 5)
          if (cancelled) break
          if (note) {
            await handleNotification(note)
          }
          setConnectionState('online')
        } catch (e) {
          if (cancelled) break
          console.warn('receiveNotification error', e)
          setConnectionState('error')
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    }

    void loop()

    return () => {
      cancelled = true
      pollingRef.current = false
    }
  }, [creds, appendMessage, upsertChat])

  const selectChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId)
      void loadHistory(chatId)
    },
    [loadHistory],
  )

  return {
    creds,
    chats,
    messagesByChat,
    activeChatId,
    connectionState,
    error,
    login,
    logout,
    createChatByPhone,
    sendText,
    selectChat,
    setActiveChatId,
  }
}
