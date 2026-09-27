import { useState, type FormEvent } from 'react'
import type { Chat } from '../types'

interface Props {
  chats: Chat[]
  activeChatId: string | null
  onSelect: (chatId: string) => void
  onCreateChat: (phone: string, name?: string) => Promise<Chat>
  onLogout: () => void
  connectionState: string
}

function formatTime(ts?: number) {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ChatList({
  chats,
  activeChatId,
  onSelect,
  onCreateChat,
  onLogout,
  connectionState,
}: Props) {
  const brand = 'Telegram'
  const [showForm, setShowForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = chats.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.chatId.toLowerCase().includes(q) ||
      (c.phoneNumber ?? '').includes(q)
    )
  })

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setBusy(true)
    try {
      await onCreateChat(phone, name)
      setPhone('')
      setName('')
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось создать чат')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    connectionState === 'online'
      ? 'онлайн'
      : connectionState === 'error'
        ? 'ошибка соединения'
        : 'подключение…'

  return (
    <aside className="chat-list">
      <header className="chat-list-header">
        <div className="brand-row">
          <div className="brand-mark telegram">TG</div>
          <div className="brand-meta">
            <strong>{brand}</strong>
            <span className={`conn conn-${connectionState}`}>{statusLabel}</span>
          </div>
          <button type="button" className="btn-ghost" onClick={onLogout} title="Выйти">
            ⇄
          </button>
        </div>

        <div className="search-box">
          <input
            type="search"
            placeholder="Поиск по чатам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button type="button" className="btn-accent" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Отмена' : '+ Новый чат'}
        </button>

        {showForm && (
          <form className="new-chat-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Телефон 79991234567 или @username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Имя (необязательно)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {formError && <div className="form-error">{formError}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Поиск…' : 'Создать чат'}
            </button>
          </form>
        )}
      </header>

      <div className="chat-list-items">
        {filtered.length === 0 && (
          <div className="empty-chats">
            <p>Чатов пока нет</p>
            <p className="muted">Создайте чат по номеру телефона или @username</p>
          </div>
        )}
        {filtered.map((chat) => {
          const active = chat.chatId === activeChatId
          return (
            <button
              type="button"
              key={chat.chatId}
              className={`chat-item ${active ? 'active' : ''}`}
              onClick={() => onSelect(chat.chatId)}
            >
              <div className="avatar">{initials(chat.name)}</div>
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-name">{chat.name}</span>
                  <span className="chat-time">{formatTime(chat.lastMessageAt)}</span>
                </div>
                <div className="chat-preview">
                  {chat.lastMessage || chat.phoneNumber || chat.chatId}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
