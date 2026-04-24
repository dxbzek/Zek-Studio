import type { ContentTheme } from '@/types'

// Keyword map for title → ContentTheme inference. Context: Dubai real estate
// (ERE Homes, Abdul) — neighborhood names and local idioms are weighted
// accordingly. Keep phrases lowercase; matching is case-insensitive.
//
// Ordering matters: the first theme whose keyword list hits wins, so put
// more specific themes before more generic ones (e.g. "new launch" before
// "property tour" so "Emaar new villa launch" maps to new_launch).
const THEME_KEYWORDS: { theme: ContentTheme; keywords: string[] }[] = [
  {
    theme: 'new_launch',
    keywords: [
      'launch', 'off-plan', 'off plan', 'pre-launch', 'new project',
      'announcing', 'announcement', 'now selling', 'handover 20',
    ],
  },
  {
    theme: 'client_story',
    keywords: [
      'testimonial', 'client story', 'happy client', 'success story',
      'sold', 'bought', 'handover', 'handed over the keys', 'reviewed',
      'thanks to', 'thank you',
    ],
  },
  {
    theme: 'market_update',
    keywords: [
      'market update', 'market report', 'market trend', 'q1 ', 'q2 ', 'q3 ', 'q4 ',
      'quarterly', 'forecast', 'statistic', 'stats', 'dubai prices',
      'price per', 'transaction volume', 'supply and demand',
    ],
  },
  {
    theme: 'investment_tips',
    keywords: [
      'invest', 'roi', 'yield', 'rental return', 'returns', 'cash flow',
      'passive income', 'golden visa', 'why dubai', 'tax free',
    ],
  },
  {
    theme: 'agent_recruitment',
    keywords: [
      'recruit', 'hiring', 'we\'re hiring', 'were hiring', 'join us',
      'join our team', 'career', 'come work', 'now hiring',
    ],
  },
  {
    theme: 'behind_scenes',
    keywords: [
      'bts', 'behind the scenes', 'behind-the-scenes', 'office', 'team day',
      'a day in', 'day in the life', 'team culture', 'our team',
    ],
  },
  {
    theme: 'area_spotlight',
    keywords: [
      'downtown', 'dubai marina', 'palm jumeirah', 'palm ', 'jbr',
      'jumeirah', 'arabian ranches', 'emirates hills', 'meydan',
      'dubai hills', 'business bay', 'al barsha', 'al quoz',
      'discovery gardens', 'jvc', 'jvt', 'dubai creek', 'neighbourhood',
      'neighborhood', 'area guide', 'area spotlight', 'best area',
      'living in ',
    ],
  },
  {
    theme: 'property_tour',
    keywords: [
      'tour', 'walkthrough', 'walk-through', 'walk through', 'villa',
      'apartment', 'penthouse', 'townhouse', 'listing', 'bedroom',
      'sq ft', 'sqft', 'property tour', 'inside this', 'step inside',
    ],
  },
]

// Returns null when no keyword matches — caller should keep whatever the
// user (or default) already has selected.
export function inferContentType(title: string): ContentTheme | null {
  const t = title.toLowerCase()
  if (!t.trim()) return null
  for (const { theme, keywords } of THEME_KEYWORDS) {
    for (const kw of keywords) {
      if (t.includes(kw)) return theme
    }
  }
  return null
}
