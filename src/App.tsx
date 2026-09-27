import { useEffect, useMemo } from 'react'
import { ChatList } from './components/ChatList'
import { ChatWindow } from './components/ChatWindow'
import { LoginScreen } from './components/LoginScreen'
import { envCredentials } from './env'
import { useMessenger } from './hooks/useMessenger'
import './App.css'

export default function App() {
  const {
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
  } = useMessenger()

  const env = useMemo(() => envCredentials(), [])

  useEffect(() => {
    if (!creds && env) {
      void login(env)
    }
  }, [creds, env, login])

  const activeChat = useMemo(
    () => chats.find((c) => c.chatId === activeChatId) ?? null,
    [chats, activeChatId],
  )

  const activeMessages = useMemo(
    () => (activeChatId ? (messagesByChat[activeChatId] ?? []) : []),
    [messagesByChat, activeChatId],
  )

  if (!creds) {
    return <LoginScreen onSubmit={login} error={error} connecting={connectionState === 'connecting'} />
  }

  return (
    <div className="app-shell">
      <ChatList
        chats={chats}
        activeChatId={activeChatId}
        onSelect={selectChat}
        onCreateChat={createChatByPhone}
        onLogout={logout}
        connectionState={connectionState}
      />
      <ChatWindow chat={activeChat} messages={activeMessages} onSend={sendText} />
    </div>
  )
}
