export type BroadcastStatus = 'pending' | 'sending' | 'done' | 'failed'
export type RecurType = 'daily' | 'weekly' | 'monthly' | 'birthday' | null
export type LogStatus = 'pending' | 'sent' | 'failed'
export type Channel = 'whatsapp' | 'gmail'

export interface Broadcast {
  id: number
  subject: string | null
  message: string
  channels: Channel[]
  recipient_group: string
  wa_delay: number
  scheduled_at: string | null
  is_recurring: number
  recur_type: RecurType
  status: BroadcastStatus
  total: number
  sent_count: number
  failed_count: number
  /** JSON-encoded number[] — specific contact IDs to target (overrides recipient_group) */
  contact_ids: string | null
  created_at: string
}

export interface CreateBroadcastPayload {
  subject?: string
  message: string
  channels: Channel[]
  recipient_group: string
  wa_delay: number
  scheduled_at?: string | null
  is_recurring?: boolean
  recur_type?: RecurType
  /** When provided, only these specific contact IDs are messaged (ignores recipient_group) */
  contact_ids?: number[]
}

export interface BroadcastProgress {
  total: number
  sent: number
  failed: number
  status: BroadcastStatus
}

export interface SendLog {
  id: number
  broadcast_id: number
  contact_id: number
  contact_name: string
  channel: Channel
  status: LogStatus
  error: string | null
  sent_at: string | null
  subject: string | null
  message: string
}

export interface LogStats {
  total: number
  sent: number
  failed: number
  pending: number
  today: number
}
