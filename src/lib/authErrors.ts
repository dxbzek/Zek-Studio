// Supabase returns English auth errors regardless of the UI language. We
// match on known phrases (not codes, which aren't always stable) and hand
// back an actionable sentence. Preserves the raw message verbatim when no
// rule matches so a genuinely useful upstream error isn't swallowed.
export function humanizeAuthError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Check for typos or reset your password.'
  }
  if (msg.includes('email not confirmed')) {
    return 'This email hasn\'t been confirmed yet. Check your inbox for the confirmation link.'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Couldn\'t reach the server. Check your connection and try again.'
  }
  return raw
}
