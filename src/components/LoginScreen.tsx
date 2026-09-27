import { useState, type FormEvent } from 'react'
import { envCredentials } from '../env'
import type { InstanceCredentials } from '../types'

interface Props {
  onSubmit: (creds: InstanceCredentials) => Promise<boolean>
  error: string | null
  connecting: boolean
}

const env = envCredentials()

export function LoginScreen({ onSubmit, error, connecting }: Props) {
  const [apiUrl, setApiUrl] = useState(env?.apiUrl ?? 'https://api.green-api.com')
  const [idInstance, setIdInstance] = useState(env?.idInstance ?? '')
  const [apiTokenInstance, setApiTokenInstance] = useState(env?.apiTokenInstance ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setLocalError('Заполните idInstance и apiTokenInstance')
      return
    }
    await onSubmit({
      apiUrl: apiUrl.trim() || 'https://api.green-api.com',
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    })
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo telegram">TG</div>
          <h1>Чат через GREEN-API</h1>
          <p>Отправка и получение текстовых сообщений в Telegram</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>API URL</span>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.green-api.com"
              autoComplete="off"
            />
          </label>

          <label>
            <span>idInstance</span>
            <input
              type="text"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              placeholder="1101000001"
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>apiTokenInstance</span>
            <input
              type="password"
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              placeholder="Токен из личного кабинета"
              autoComplete="off"
              required
            />
          </label>

          {(localError || error) && <div className="login-error">{localError || error}</div>}

          <button type="submit" className="btn-primary" disabled={connecting}>
            {connecting ? 'Подключение…' : 'Войти в Telegram'}
          </button>
        </form>

        <div className="login-hint">
          <p>
            Учётные данные — в{' '}
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
              личном кабинете GREEN-API
            </a>{' '}
            (инстанс Telegram).
          </p>
          <p>
            Для приёма сообщений оставьте <code>webhookUrl</code> пустым и включите входящие
            уведомления в настройках инстанса.
          </p>
        </div>
      </div>
    </div>
  )
}
