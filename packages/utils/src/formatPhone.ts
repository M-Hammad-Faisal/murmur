/**
 * Normalize a phone number into WhatsApp's required format.
 * Input:  +92 300-123-4567  or  0300-1234567  or  923001234567
 * Output: 923001234567@c.us
 */
export function formatPhone(phone: string): string | null {
  if (!phone) return null

  // Strip all non-digit characters except leading +
  let cleaned = phone.toString().replace(/[\s\-().]/g, '')

  // Remove leading +
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)

  // Must be at least 7 digits
  if (cleaned.length < 7) return null

  return `${cleaned}@c.us`
}

/**
 * Check if a string looks like a valid phone number.
 */
export function isValidPhone(phone: string): boolean {
  return formatPhone(phone) !== null
}
