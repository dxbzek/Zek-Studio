import { describe, it, expect } from 'vitest'
import { inferContentType, inferByNameMatch } from '../inferContentType'

describe('inferContentType', () => {
  it('returns null for empty / whitespace titles', () => {
    expect(inferContentType('')).toBeNull()
    expect(inferContentType('   ')).toBeNull()
  })

  it('returns null when no keyword matches', () => {
    expect(inferContentType('Some unrelated chatter')).toBeNull()
  })

  it('matches property-tour keywords', () => {
    expect(inferContentType('Walkthrough of a new villa')).toBe('property_tour')
    expect(inferContentType('3-bedroom penthouse tour')).toBe('property_tour')
  })

  it('matches neighborhood names as area_spotlight', () => {
    expect(inferContentType('Inside Dubai Marina')).toBe('area_spotlight')
    expect(inferContentType('Living in Jumeirah')).toBe('area_spotlight')
  })

  it('prioritizes new_launch over property_tour when both keywords are present', () => {
    // Ordering in the keyword table makes new_launch win; validates the
    // documented priority behaviour so re-ordering doesn't silently
    // break the dominant theme for "new launch" titles.
    expect(inferContentType('Emaar new villa launch tour')).toBe('new_launch')
  })

  it('matches case-insensitively', () => {
    expect(inferContentType('BTS at the office')).toBe('behind_scenes')
    expect(inferContentType('bts at the office')).toBe('behind_scenes')
  })

  it('matches client stories on handover phrasing', () => {
    expect(inferContentType('Handover day for our client')).toBe('client_story')
    expect(inferContentType('Their happy client review')).toBe('client_story')
  })

  it('matches market updates on quarterly prefixes', () => {
    // Note: the keyword is "q1 " with trailing space so it doesn't match
    // "IQ1 " substrings. We expect a trailing space after the digit.
    expect(inferContentType('Q1 2026 market update')).toBe('market_update')
  })
})

describe('inferByNameMatch', () => {
  it('returns null for empty titles', () => {
    expect(inferByNameMatch('', [{ id: 'a', name: 'Summer Sale' }])).toBeNull()
  })

  it('returns null when no option name is in the title', () => {
    expect(inferByNameMatch('Random post', [
      { id: 'a', name: 'Summer Sale' },
      { id: 'b', name: 'Winter Promo' },
    ])).toBeNull()
  })

  it('matches case-insensitively', () => {
    expect(inferByNameMatch('summer sale post', [
      { id: 'a', name: 'Summer Sale' },
    ])).toBe('a')
  })

  it('skips option names shorter than 4 chars to avoid over-matching', () => {
    // A campaign named "Q1" would hit every "q1" in the title, which is
    // usually not what the user wants — we intentionally skip short names.
    expect(inferByNameMatch('Q1 Marina penthouse', [
      { id: 'a', name: 'Q1' },
    ])).toBeNull()
  })

  it('returns the first match when multiple options would hit', () => {
    expect(inferByNameMatch('Winter Sale on Dubai villas', [
      { id: 'first',  name: 'Winter Sale' },
      { id: 'second', name: 'Dubai Villas' },
    ])).toBe('first')
  })
})
