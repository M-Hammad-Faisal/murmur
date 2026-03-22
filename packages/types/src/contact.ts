export interface Contact {
  id: number
  name: string
  phone: string | null
  email: string | null
  tag: string | null
  birthday: string | null
  extra_data: Record<string, string>
  created_at: string
}

export interface ContactGroup {
  tag: string
  count: number
}

export interface ContactGroupsResponse {
  total: number
  groups: ContactGroup[]
}

export interface CsvPreviewResponse {
  columns: string[]
  preview: Record<string, string>[]
  total: number
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  columns: string[]
}
