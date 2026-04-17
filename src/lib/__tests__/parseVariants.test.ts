import { describe, it, expect } from 'vitest'
import { parseVariants } from '../parseVariants'

describe('parseVariants', () => {
  it('parses numbered list with dots', () => {
    const input = '1. First hook\n2. Second hook\n3. Third hook'
    expect(parseVariants(input)).toEqual(['First hook', 'Second hook', 'Third hook'])
  })

  it('parses numbered list with parentheses', () => {
    const input = '1) First hook\n2) Second hook'
    expect(parseVariants(input)).toEqual(['First hook', 'Second hook'])
  })

  it('limits to 3 variants from numbered list', () => {
    const input = '1. A\n2. B\n3. C\n4. D'
    expect(parseVariants(input)).toHaveLength(3)
  })

  it('falls back to paragraph-split when no numbered list', () => {
    const input = 'First paragraph\n\nSecond paragraph\n\nThird paragraph'
    expect(parseVariants(input)).toEqual(['First paragraph', 'Second paragraph', 'Third paragraph'])
  })

  it('returns single-item array for plain text with no structure', () => {
    const input = 'Just a single line of content'
    expect(parseVariants(input)).toEqual(['Just a single line of content'])
  })

  it('trims whitespace from variants', () => {
    const input = '1.  Lots of spaces   \n2.   Another one  '
    const result = parseVariants(input)
    expect(result[0]).toBe('Lots of spaces')
    expect(result[1]).toBe('Another one')
  })

  it('filters empty lines from numbered list', () => {
    const input = '1. Good\n\n2. Also good\n3. Third'
    expect(parseVariants(input)).toEqual(['Good', 'Also good', 'Third'])
  })

  it('requires at least 2 paragraphs to use paragraph fallback', () => {
    const input = 'Only one paragraph here with no double newlines'
    expect(parseVariants(input)).toEqual([input.trim()])
  })
})
