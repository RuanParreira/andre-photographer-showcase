export const categories = ['Urban', 'Landscape', 'Nature']

// Two independent axes, on purpose:
//
// `shape` is layout only — the aspect the frame takes in its masonry column
// (see WorkItem.jsx). The column packing removes the dead space that fixed rows
// left whenever a wide frame sat beside a tall one, so what matters here is
// that consecutive shapes differ: a run of three `portrait` in a row would
// rebuild the uniform stack the masonry exists to break up.
//
// `tier` is hierarchy only — how loudly a piece is captioned, and whether it
// gets the taller portrait treatment. Three featured works carry the section;
// the rest support them. Keeping the two apart means a piece can be re-weighted
// without touching the composition, and vice versa.
export const works = [
  {
    slug: 'canal-light',
    title: 'Canal Light',
    location: 'Prague, Czech Republic',
    year: '2023',
    category: 'Urban',
    shape: 'portrait',
    tier: 'featured',
  },
  {
    slug: 'ameyoko',
    title: 'Ameyoko',
    location: 'Tokyo, Japan',
    year: '2024',
    category: 'Urban',
    shape: 'tall',
    tier: 'secondary',
  },
  {
    slug: 'low-tide',
    title: 'Low Tide',
    location: 'Lake Tahoe, USA',
    year: '2022',
    category: 'Landscape',
    shape: 'landscape',
    tier: 'secondary',
  },
  {
    slug: 'aare',
    title: 'Aare',
    location: 'Bern, Switzerland',
    year: '2023',
    category: 'Landscape',
    shape: 'portrait',
    tier: 'secondary',
  },
  {
    slug: 'gold-fields',
    title: 'Gold Fields',
    location: 'Vidzeme, Latvia',
    year: '2024',
    category: 'Nature',
    shape: 'square',
    tier: 'secondary',
  },
  {
    slug: 'bloom',
    title: 'Bloom',
    location: 'Vidzeme, Latvia',
    year: '2024',
    category: 'Nature',
    shape: 'tall',
    tier: 'featured',
  },
  {
    slug: 'braies-boats',
    title: 'Still Water',
    location: 'Lago di Braies, Italy',
    year: '2024',
    category: 'Landscape',
    shape: 'landscape',
    tier: 'secondary',
  },
  {
    slug: 'palm-mirror',
    title: 'Palm Mirror',
    location: 'Zanzibar, Tanzania',
    year: '2023',
    category: 'Nature',
    shape: 'portrait',
    tier: 'secondary',
  },
  {
    slug: 'glenfinnan',
    title: 'Jacobite Line',
    location: 'Glenfinnan, Scotland',
    year: '2024',
    category: 'Urban',
    shape: 'landscape',
    tier: 'featured',
  },
  {
    slug: 'braies-boathouse',
    title: 'The Boathouse',
    location: 'Lago di Braies, Italy',
    year: '2024',
    category: 'Landscape',
    shape: 'square',
    tier: 'secondary',
  },
]
