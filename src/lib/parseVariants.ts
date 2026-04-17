export function parseVariants(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const numbered = lines
    .filter((l) => /^\d+[\.\)]/.test(l))
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
  if (numbered.length >= 1) return numbered.slice(0, 3)
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length >= 2) return paragraphs.slice(0, 3)
  return [text.trim()]
}
