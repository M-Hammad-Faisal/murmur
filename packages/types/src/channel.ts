export type WhatsAppStatus = 'disconnected' | 'qr' | 'connecting' | 'ready' | 'error'

export interface WhatsAppStatusResponse {
  status: WhatsAppStatus
  qrDataUrl: string | null
  message: string
}

export interface GmailStatus {
  connected: boolean
  user: string | null
}

export interface ChannelStatusResponse {
  gmail: GmailStatus
  whatsapp: WhatsAppStatusResponse
}

export interface SaveGmailPayload {
  user: string
  pass: string
  name?: string
}
