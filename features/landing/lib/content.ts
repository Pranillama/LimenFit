// TODO: swap these before launch
export const GITHUB_URL = 'https://github.com/limenfit/limenfit';
export const CONTACT_EMAIL = 'hello@limenfit.app';

export const HERO = {
  headline: 'Log every set. Own every lift.',
  subheadline:
    'LimenFit is the fastest way to track workouts, share training plans, and — soon — get AI-powered form feedback.',
  cta: 'Get Started',
  secondaryCta: "See what's coming",
  secondaryHref: '#features',
} as const;

export type FeatureIllustration = 'fast-logging' | 'offline' | 'plan-share' | 'analyze';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  illustration: FeatureIllustration;
  comingSoon?: boolean;
}

export const FEATURES: FeatureItem[] = [
  {
    id: 'fast-logging',
    title: 'Fast logging',
    description:
      'Add sets and reps in seconds — no tapping through menus. LimenFit gets out of the way so you can focus on your training.',
    illustration: 'fast-logging',
  },
  {
    id: 'offline',
    title: 'Offline-first',
    description:
      'Your workout data lives on your device first. Log sessions in the basement gym or in the mountains with zero connectivity.',
    illustration: 'offline',
  },
  {
    id: 'plan-share',
    title: 'Plan sharing',
    description:
      'Build structured training programmes and share them with teammates or coaches with a single link.',
    illustration: 'plan-share',
  },
  {
    id: 'analyze',
    title: 'AI form analysis',
    description:
      'Upload a clip of your lift and get instant technique feedback powered by computer vision. Catch form breaks before they become injuries.',
    illustration: 'analyze',
    comingSoon: true,
  },
];

export const WHY_LIMENFIT = {
  heading: 'Why LimenFit?',
  pain: "Most fitness apps are bloated with social feeds and subscription paywalls. When you're mid-session, the last thing you need is friction.",
  success:
    "LimenFit is built around a single promise: log fast, reflect clearly, improve consistently — whether you're a solo lifter or coaching a team.",
} as const;

export const CONTACT = {
  heading: 'Get in touch',
  body: 'Have a question, a feature request, or just want to say hi? We read every email.',
  cta: 'Email us',
} as const;

export type FooterLinkGroup = {
  label: string;
  links: { label: string; href: string; external?: boolean }[];
};

export const FOOTER_LINKS: FooterLinkGroup[] = [
  {
    label: 'Product',
    links: [
      { label: 'Get Started', href: '/auth' },
      { label: 'Sign in', href: '/auth' },
    ],
  },
  {
    label: 'Resources',
    links: [{ label: 'GitHub', href: GITHUB_URL, external: true }],
  },
  {
    label: 'Legal',
    links: [
      // TODO: replace # with real routes once Privacy/Terms pages exist
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
  {
    label: 'Contact',
    links: [{ label: 'Email', href: `mailto:${CONTACT_EMAIL}`, external: true }],
  },
];
