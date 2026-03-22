import type { Contact } from '@murmur/types'

/**
 * Replace {{variable}} tokens in a template string with contact field values.
 * Supports all known fields + any extra_data fields from CSV columns.
 *
 * @example
 * replaceVars('Hi {{name}}!', contact) // 'Hi Ahmed!'
 */
export function replaceVars(template: string, contact: Contact): string {
  if (!template) return ''

  const data: Record<string, string> = {
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    tag: contact.tag ?? '',
    birthday: contact.birthday ?? '',
    ...contact.extra_data,
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '')
}

/**
 * Extract all {{variable}} token names from a template string.
 * Used to show variable chips in the composer.
 */
export function extractVars(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}
