import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Chat, Message } from '../types'

interface Props {
  chat: Chat | null
  messages: Message[]
  onSend: (chatId: string, text: string) => Promise<void>
}

function formatBubbleTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dayLabel(ts: number) {
  const date = new Date(ts * 1000)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  const day = Math.floor(ts)
  if (day >= today) return 'Сегодня'
  if (day >= today - 86400) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function statusIcon(status: Message['status']) {
  if (status === 'sending') return '…'
  if (status === 'failed') return '!'
  return '✓'
}

export function ChatWindow({ chat, messages, onSend }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, chat?.chatId])

  const groups = useMemo(() => {
    const result: { label: string; items: Message[] }[] = []
    let currentLabel = ''
    for (const msg of messages) {
      const label = dayLabel(msg.timestamp)
      if (label !== currentLabel) {
        result.push({ label, items: [msg] })
        currentLabel = label
      } else {
        result[result.length - 1].items.push(msg)
      }
    }
    return result
  }, [messages])

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!chat || !draft.trim() || sending) return
    setSending(true)
    setSendError(null)
    try {
      await onSend(chat.chatId, draft)
      setDraft('')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  if (!chat) {
    return (
      <section className="chat-window empty">
        <div className="empty-state">
          <div className="empty-logo telegram">TG</div>
          <h2>Выберите чат</h2>
          <p>Создайте новый чат по номеру телефона или выберите существующий слева</p>
        </div>
      </section>
    )
  }

  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <div className="avatar">{initials(chat.name)}</div>
        <div>
          <div className="chat-title">{chat.name}</div>
          <div className="chat-subtitle">{chat.phoneNumber || chat.chatId}</div>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="messages-empty">
            Сообщений пока нет. Напишите первое сообщение — оно уйдёт в Telegram через GREEN-API.
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="day-group">
            <div className="day-divider">{group.label}</div>
            {group.items.map((msg) => (
              <div key={msg.id} className={`bubble-row ${msg.isOutgoing ? 'out' : 'in'}`}>
                <div className={`bubble ${msg.isOutgoing ? 'out' : 'in'}`}>
                  {!msg.isOutgoing && msg.senderName && groups.length > 0 && (
                    <div className="bubble-sender">{msg.senderName}</div>
                  )}
                  <div className="bubble-text">{msg.text}</div>
                  <div className="bubble-meta">
                    <span>{formatBubbleTime(msg.timestamp)}</span>
                    {msg.isOutgoing && (
                      <span className={`tick tick-${msg.status}`}>{statusIcon(msg.status)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Введите сообщение…"
          rows={1}
          maxLength={4000}
        />
        {sendError && <div className="composer-error">{sendError}</div>}
        <button type="submit" className="btn-send" disabled={sending || !draft.trim()}>
          {sending ? '…' : '➤'}
        </button>
      </form>
    </section>
  )
}
