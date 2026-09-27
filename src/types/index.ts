export interface InstanceCredentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type ChatType = 'user' | 'group'

export interface Chat {
  chatId: string
  name: string
  chatType: ChatType
  phoneNumber?: string
  lastMessage?: string
  lastMessageAt?: number
  unread?: number
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface Message {
  id: string
  chatId: string
  text: string
  timestamp: number
  isOutgoing: boolean
  senderName?: string
  status: MessageStatus
}

export interface IncomingNotification {
  receiptId: number
  body: {
    typeWebhook: string
    instanceData?: {
      idInstance: number
      wid?: string
      typeInstance?: string
    }
    timestamp: number
    idMessage: string
    senderData?: {
      chatId: string
      chatName?: string
      chatType?: string
      sender?: string
      senderName?: string
      senderType?: string
      senderContactName?: string
      senderPhoneNumber?: number | string
    }
    messageData?: {
      typeMessage: string
      textMessageData?: {
        textMessage: string
      }
      extendedTextMessageData?: {
        text: string
      }
    }
    statusMessage?: string
  }
}

export interface CheckAccountResponse {
  exist: boolean
  chatId?: string
}

export interface SendMessageResponse {
  idMessage: string
}
