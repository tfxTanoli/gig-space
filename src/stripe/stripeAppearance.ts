export const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#1e293b',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    borderRadius: '8px',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '16px',
  },
  rules: {
    // padding + lineHeight + 1px border on each side = 36px, matching the
    // h-9 inputs used elsewhere in the app. fontSize is pinned rather than left
    // to inherit fontSizeBase so these fields always read at the same 16px our
    // own mobile inputs are floored to in index.css — Stripe renders inside an
    // iframe, so the app's stylesheet cannot reach them.
    '.Input': { border: '1px solid #334155', backgroundColor: '#1e293b', padding: '8px 16px', fontSize: '16px', lineHeight: '18px', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none', outline: 'none' },
    '.Label': { color: '#cbd5e1', fontSize: '13px' },
    '.Tab': { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', backgroundColor: '#1e293b', border: '1px solid #334155', boxShadow: 'none' },
    '.Tab--selected': { backgroundColor: '#1e293b', border: '1px solid #3b82f6', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: 'none' },
    '.Block': { boxShadow: 'none' },
  } as Record<string, Record<string, string>>,
};

// Light-mode counterpart (GIG-73). Stripe renders in an iframe our stylesheet
// can't reach, so the form needs its own palette per theme.
export const STRIPE_APPEARANCE_LIGHT = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#ffffff',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    borderRadius: '8px',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '16px',
  },
  rules: {
    '.Input': { border: '1px solid #cbd5e1', backgroundColor: '#ffffff', padding: '8px 16px', fontSize: '16px', lineHeight: '18px', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none', outline: 'none' },
    '.Label': { color: '#334155', fontSize: '13px' },
    '.Tab': { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', boxShadow: 'none' },
    '.Tab--selected': { backgroundColor: '#ffffff', border: '1px solid #3b82f6', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: 'none' },
    '.Block': { boxShadow: 'none' },
  } as Record<string, Record<string, string>>,
};

/** The Stripe Elements appearance for the active theme. */
export const stripeAppearance = (theme: 'light' | 'dark') =>
  theme === 'light' ? STRIPE_APPEARANCE_LIGHT : STRIPE_APPEARANCE;

export const STRIPE_FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
];
