// ─────────────────────────────────────────────────────────────────────────────
//  CLIENT CONFIG — Meridian Studio (demo data)
//  Fork this repo, edit this file, push → GitHub Pages live in ~60 seconds.
//  DO NOT add API keys. DO NOT add secrets of any kind.
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT = {

  // ── BRAND ─────────────────────────────────────────────────────────────────
  brand: {
    name: 'Meridian Studio',
    tagline: 'Architecture & Interior Design',
    logo: null,           // null = text fallback; or relative path: 'assets/logo.svg'
    accentColor: '#B8962E',  // brand accent hex — buttons, links, highlights
    darkMode: true,       // true = dark by default; false = light by default
  },

  // ── NAV ───────────────────────────────────────────────────────────────────
  nav: {
    links: [
      { label: 'Services', href: '#services' },
      { label: 'About',    href: '#about'    },
      { label: 'Work',     href: '#work'     },
      { label: 'Contact',  href: '#contact'  },
    ],
    ctaLabel: 'Start a Project',
    ctaHref:  '#contact',
  },

  // ── HERO ──────────────────────────────────────────────────────────────────
  hero: {
    eyebrow:     'Architecture & Interior Design',
    headline:    'Spaces Built Around\nHow You Live',
    subheadline: 'Meridian Studio creates thoughtful, enduring spaces for discerning clients — from concept through construction.',
    cta1: { label: 'View Our Work', href: '#work'    },
    cta2: { label: 'Get in Touch',  href: '#contact' },
    imageSrc: null,           // null = gradient placeholder; or 'assets/hero.jpg'
    imageAlt: 'Meridian Studio — open-plan living room with warm finishes',
  },

  // ── SERVICES ──────────────────────────────────────────────────────────────
  services: {
    eyebrow:  'What We Do',
    headline: 'Full-Spectrum Design',
    items: [
      {
        icon:  'layout-panel-left',
        title: 'Interior Design',
        desc:  'Full-service residential and commercial interior design, from schematic concepts to final installation.',
      },
      {
        icon:  'building-2',
        title: 'Architecture',
        desc:  'Custom new construction and renovations, seamlessly integrated with the surrounding landscape.',
      },
      {
        icon:  'pencil-ruler',
        title: 'Space Planning',
        desc:  'Functional analysis and layout optimisation for every room, floor, or building footprint.',
      },
      {
        icon:  'palette',
        title: 'Materials & Finishes',
        desc:  'Curated selections from our global supplier network — stone, wood, textile, and metal.',
      },
      {
        icon:  'sofa',
        title: 'Furnishings',
        desc:  'Custom furniture design and procurement from leading artisan studios worldwide.',
      },
      {
        icon:  'lightbulb',
        title: 'Lighting Design',
        desc:  'Layered lighting strategies that shape mood, highlight architecture, and improve daily wellbeing.',
      },
    ],
  },

  // ── ABOUT ─────────────────────────────────────────────────────────────────
  about: {
    eyebrow:  'Studio Story',
    headline: 'Fifteen Years of\nPurposeful Design',
    body:     'Founded in 2009 by principal designer Calla Rhodes, Meridian Studio has grown from a boutique residential practice into a full-service design and architecture firm. We work in close collaboration with clients, craftspeople, and contractors to build spaces that feel inevitable — as though they could never have been any other way.',
    imageSrc: null,           // null = accent-tinted placeholder
    imageAlt: 'Principal designer Calla Rhodes in the Meridian Studio workspace',
    stats: [
      { value: '150+', label: 'Projects Completed' },
      { value: '12',   label: 'Design Awards'       },
      { value: '15',   label: 'Years in Practice'   },
      { value: '3',    label: 'Countries Served'    },
    ],
  },

  // ── WORK ──────────────────────────────────────────────────────────────────
  work: {
    eyebrow:  'Selected Projects',
    headline: 'Recent Work',
    items: [
      {
        title:    'Marin Residence',
        category: 'Residential',
        year:     '2024',
        imageSrc: null,
        imageAlt: 'Marin hillside residence — living room with valley views',
        hex:      '#8C7E5C',
      },
      {
        title:    'Covington Loft',
        category: 'Interior Design',
        year:     '2024',
        imageSrc: null,
        imageAlt: 'Industrial loft conversion — exposed brick and warm textiles',
        hex:      '#5C6E8C',
      },
      {
        title:    'Pacific Heights Townhouse',
        category: 'Architecture',
        year:     '2023',
        imageSrc: null,
        imageAlt: 'Victorian townhouse renovation — restored facade, modern interior',
        hex:      '#6E8C5C',
      },
      {
        title:    'Fillmore Gallery',
        category: 'Commercial',
        year:     '2023',
        imageSrc: null,
        imageAlt: 'Contemporary art gallery — white walls, sculptural lighting',
        hex:      '#7C5C8C',
      },
      {
        title:    'Noe Valley Kitchen',
        category: 'Interior Design',
        year:     '2022',
        imageSrc: null,
        imageAlt: 'Minimalist kitchen remodel — Calacatta marble, walnut cabinetry',
        hex:      '#8C5C5C',
      },
      {
        title:    'Mill Valley Studio',
        category: 'Architecture',
        year:     '2022',
        imageSrc: null,
        imageAlt: 'Light-filled artist studio — north-facing clerestory windows',
        hex:      '#5C8C7E',
      },
    ],
  },

  // ── TESTIMONIALS ──────────────────────────────────────────────────────────
  testimonials: {
    eyebrow:  'Client Words',
    headline: 'What People Say',
    items: [
      {
        quote: 'Calla and her team transformed our chaotic house into a home that finally reflects who we are. Every detail was considered, every decision intentional.',
        name:  'James & Priya Ellison',
        title: 'Marin Residence, 2024',
      },
      {
        quote: 'Working with Meridian was the easiest part of our renovation. They managed everything, delivered on time, and the result is stunning.',
        name:  'David Thornton',
        title: 'Covington Loft, 2024',
      },
      {
        quote: 'The studio brought a level of craft and calm to a complex project that exceeded every expectation we had. We will work with no one else.',
        name:  'Serena Nakamura',
        title: 'Pacific Heights Townhouse, 2023',
      },
    ],
  },

  // ── CONTACT ───────────────────────────────────────────────────────────────
  contact: {
    eyebrow:    'Start a Conversation',
    headline:   "Let's Build\nSomething",
    subtext:    'We take on a limited number of projects each year to ensure every client receives our full attention. Reach out to discuss your project.',
    email:      'hello@meridianstudio.co',
    phone:      '+1 (415) 555-0192',
    address:    'San Francisco, CA',
    formspreeId: '',   // Set to your Formspree ID e.g. "xabc1234" — falls back to mailto if empty
  },

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  social: [
    { platform: 'Instagram', href: 'https://instagram.com/meridianstudio', icon: 'instagram'  },
    { platform: 'Pinterest', href: 'https://pinterest.com/meridianstudio', icon: 'pin'        },
    { platform: 'LinkedIn',  href: 'https://linkedin.com/company/meridianstudio', icon: 'linkedin'  },
  ],

  // ── FOOTER ────────────────────────────────────────────────────────────────
  footer: {
    tagline:    'Architecture & Interior Design — San Francisco',
    year:       2024,
    links: [
      { label: 'Services', href: '#services' },
      { label: 'About',    href: '#about'    },
      { label: 'Work',     href: '#work'     },
      { label: 'Contact',  href: '#contact'  },
    ],
    credit:     'Site by Lucky Black Media',
    creditHref: 'https://myluckyblackmedia.com',
  },

  // ── TYPOGRAPHY ────────────────────────────────────────────────────────────
  // Font families are CSS font-stack strings.
  // fontLinks are loaded dynamically by the renderer.
  typography: {
    displayFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont:    "'Satoshi', 'Helvetica Neue', sans-serif",
    fontLinks: [
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap',
      'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap',
    ],
  },

  // ── LAYOUT ────────────────────────────────────────────────────────────────
  layout: {
    spacing:      'normal',    // compact | normal | generous
    radius:       'soft',      // sharp | soft | rounded | pill
    contentWidth: 'standard',  // narrow (960px) | standard (1200px) | wide (1440px)
  },

  // ── COLORS ────────────────────────────────────────────────────────────────
  // null = use default theme value. Set hex strings to override.
  colors: {
    bg:          null,  // Page background     (dark: #090909 / light: #FAFAF8)
    bgAlt:       null,  // Section background  (dark: #111111 / light: #F2F0EB)
    surface:     null,  // Card / surface      (dark: #161616 / light: #ECEAE4)
    textPrimary: null,  // Heading text        (dark: #EFECE7 / light: #1A1916)
    textSecond:  null,  // Body text           (dark: #9A9794 / light: #706D6A)
    textMuted:   null,  // Hint / muted text   (dark: #575451 / light: #A09D9A)
  },

};
