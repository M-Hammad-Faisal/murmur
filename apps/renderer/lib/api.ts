import type {
  ChannelStatusResponse,
  SaveGmailPayload,
  Contact,
  ContactGroupsResponse,
  ImportResult,
  Broadcast,
  CreateBroadcastPayload,
  BroadcastProgress,
  SendLog,
  LogStats,
} from '@murmur/types'

// In dev, Next.js rewrites /api/* → localhost:4000 via next.config.ts.
// In production (Electron static export), there is no proxy — call the server directly.
const BASE =
  typeof window !== 'undefined' && window.location.protocol === 'app:'
    ? 'http://localhost:4000'
    : '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Channels ─────────────────────────────────────────────────────────────────

export const channels = {
  status: () => request<ChannelStatusResponse>('/channels/status'),
  saveGmail: (payload: SaveGmailPayload) =>
    request<{ success: boolean }>('/channels/gmail/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disconnectGmail: () => request<{ success: boolean }>('/channels/gmail', { method: 'DELETE' }),
  connectWhatsApp: () =>
    request<{ success: boolean }>('/channels/whatsapp/connect', { method: 'POST' }),
  whatsAppStatus: () => request<ChannelStatusResponse['whatsapp']>('/channels/whatsapp/status'),
  disconnectWhatsApp: () =>
    request<{ success: boolean }>('/channels/whatsapp/disconnect', { method: 'POST' }),
  retryWhatsApp: () =>
    request<{ success: boolean }>('/channels/whatsapp/retry', { method: 'POST' }),
  resetWhatsApp: () =>
    request<{ success: boolean }>('/channels/whatsapp/reset-session', { method: 'POST' }),
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = {
  list: (tag?: string) =>
    request<Contact[]>(`/contacts${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  groups: () => request<ContactGroupsResponse>('/contacts/groups'),
  upload: (file: File, replace = false) => {
    const form = new FormData()
    form.append('file', file)
    return request<ImportResult>(`/contacts/upload?replace=${replace}`, {
      method: 'POST',
      headers: {},
      body: form,
    })
  },
  preview: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ columns: string[]; preview: Record<string, string>[]; total: number }>(
      '/contacts/upload?preview=true',
      { method: 'POST', headers: {}, body: form },
    )
  },
  deleteAll: () => request<{ success: boolean }>('/contacts/all', { method: 'DELETE' }),
  deleteOne: (id: number) => request<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),
  updateOne: (
    id: number,
    data: {
      name?: string
      phone?: string | null
      email?: string | null
      tag?: string | null
      birthday?: string | null
    },
  ) =>
    request<{ success: boolean }>(`/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

export const broadcasts = {
  create: (payload: CreateBroadcastPayload) =>
    request<{ success: boolean; broadcastId: number }>('/broadcasts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  list: () => request<Broadcast[]>('/broadcasts'),
  progress: (id: number) => request<BroadcastProgress>(`/broadcasts/${id}/progress`),
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export const logs = {
  list: (params?: { broadcast_id?: number; status?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.broadcast_id) qs.set('broadcast_id', String(params.broadcast_id))
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return request<SendLog[]>(`/logs${q ? `?${q}` : ''}`)
  },
  stats: () => request<LogStats>('/logs/stats'),
  retry: (id: number) => request<{ success: boolean }>(`/logs/${id}/retry`, { method: 'POST' }),
  deleteOne: (id: number) => request<{ success: boolean }>(`/logs/${id}`, { method: 'DELETE' }),
  clearByStatus: (status: string) =>
    request<{ success: boolean }>(`/logs/by-status?status=${encodeURIComponent(status)}`, {
      method: 'DELETE',
    }),
  clearAll: () => request<{ success: boolean }>('/logs/all', { method: 'DELETE' }),
}
