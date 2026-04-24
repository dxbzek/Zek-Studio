import { describe, it, expect } from 'vitest'
import { humanizeAuthError } from '../authErrors'

describe('humanizeAuthError', () => {
  it('rewrites invalid credentials', () => {
    expect(humanizeAuthError('Invalid login credentials'))
      .toMatch(/Email or password is incorrect/)
  })

  it('rewrites email not confirmed — triggers inline resend UI', () => {
    // LoginPage keys its "Resend confirmation email" button off the
    // phrase "confirmation link" in the humanized message; preserving
    // that phrase is load-bearing. If this test fails, check whether the
    // humanized copy in authErrors.ts was changed without updating the
    // resend-button guard in LoginPage.tsx.
    const out = humanizeAuthError('Email not confirmed')
    expect(out).toMatch(/confirmation link/)
  })

  it('rewrites rate-limit messages regardless of exact wording', () => {
    expect(humanizeAuthError('Rate limit exceeded'))
      .toMatch(/Too many attempts/)
    expect(humanizeAuthError('Too many signup attempts'))
      .toMatch(/Too many attempts/)
  })

  it('rewrites network / fetch failures', () => {
    expect(humanizeAuthError('Failed to fetch'))
      .toMatch(/Couldn't reach the server/)
    expect(humanizeAuthError('Network error'))
      .toMatch(/Couldn't reach the server/)
  })

  it('preserves unknown messages verbatim', () => {
    const upstream = 'Database is on fire'
    expect(humanizeAuthError(upstream)).toBe(upstream)
  })

  it('matches case-insensitively', () => {
    expect(humanizeAuthError('INVALID LOGIN CREDENTIALS'))
      .toMatch(/Email or password is incorrect/)
  })
})
