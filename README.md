# Telegram Chat — React + GREEN-API

Тестовое задание на должность **«Фронтенд разработчик React»**: пользовательский интерфейс для отправки и получения текстовых сообщений в **Telegram** через сервис [GREEN-API](https://green-api.com/telegram).

## Возможности

- Подключение по учётным данным GREEN-API (`apiUrl`, `idInstance`, `apiTokenInstance`)
- Создание чата по номеру телефона или `@username` через `CheckAccount`
- Отправка текстовых сообщений методом [`SendMessage`](https://green-api.com/telegram/docs/api/sending/SendMessage/)
- Получение входящих сообщений по технологии [HTTP API](https://green-api.com/telegram/docs/api/receiving/technology-http-api/) (`ReceiveNotification` + `DeleteNotification`)
- Загрузка истории переписки (`GetChatHistory`)
- Список чатов, переключение между чатами, статусы сообщений
- Локальное сохранение сессии и переписки в `localStorage`

## Стек

- React 19 + TypeScript
- Vite
- Без UI-библиотек — чистый CSS

## Локальный запуск

### Требования

- Node.js 20+ (рекомендуется 22/24)
- npm 10+

### Шаги

```bash
# 1. Перейти в каталог проекта
cd GreenAPI

# 2. Установить зависимости
npm install

# 3. Запустить dev-сервер
npm run dev
```

Приложение откроется по адресу [http://localhost:5173](http://localhost:5173).

### Продакшен-сборка

```bash
npm run build
npm run preview
```

Сборка будет в каталоге `dist/` — её можно разместить на любом статическом хостинге (GitHub Pages, Netlify, Vercel, nginx и т.д.).

## Подключение GREEN-API (Telegram)

1. Зарегистрируйтесь в [console.green-api.com](https://console.green-api.com/).
2. Создайте инстанс **Telegram** (тариф «Разработчик» — бесплатно).
3. Авторизуйте инстанс (QR-код / код авторизации).
4. В настройках инстанса:
   - оставьте `webhookUrl` **пустым** (используется HTTP API long-polling);
   - включите уведомления: `incomingWebhook`, `outgoingWebhook`, `stateWebhook`.
5. В приложении введите `idInstance` и `apiTokenInstance`.

Можно задать переменные в `.env` (см. `.env.example`):

```
VITE_GREEN_API_URL=https://api.green-api.com
VITE_GREEN_API_ID_INSTANCE=...
VITE_GREEN_API_TOKEN=...
```

### Используемые методы API

| Метод | Назначение |
| --- | --- |
| `getStateInstance` | проверка авторизации инстанса |
| `setSettings` | включение входящих уведомлений |
| `checkAccount` | получение `chatId` по номеру телефона или @username |
| `sendMessage` | отправка текстового сообщения |
| `receiveNotification` | long-polling входящих уведомлений |
| `deleteNotification` | подтверждение обработки уведомления |
| `getChatHistory` | история сообщений чата |
| `getChats` | список чатов |
| `lastIncomingMessages` / `lastOutgoingMessages` | журнал сообщений |

### Формат chatId

- Личный чат: `"10000000"` (или `79991234567@c.us` для обратной совместимости)
- Групповой чат: `"-10000000000000"`

Рекомендуемый сценарий: `CheckAccount(phone или @username)` → `chatId` → `SendMessage`.

## Сценарий использования

1. Ввести учётные данные GREEN-API и нажать **«Войти в Telegram»**.
2. Нажать **«+ Новый чат»**, указать номер телефона (`79991234567`) или `@username` собеседника.
3. Написать текстовое сообщение и отправить (кнопка или `Enter`).
4. Получатель отвечает в Telegram — ответ появляется в чате автоматически.

## Структура проекта

```
src/
  api/greenApi.ts       # клиент GREEN-API
  components/
    LoginScreen.tsx     # форма подключения
    ChatList.tsx        # список чатов + создание чата
    ChatWindow.tsx      # переписка и отправка
  hooks/useMessenger.ts # состояние, polling, localStorage
  types/index.ts        # типы
  App.tsx
```

## Ограничения (по ТЗ)

- Только текстовые сообщения
- Минимальный набор функций
- Простой и понятный UI

## Скриншоты

- `docs/screenshot-login.png` — экран подключения
- `docs/screenshot-chat.png` — переписка (реальные данные инстанса)

## Лицензия

Учебный / тестовый проект.
