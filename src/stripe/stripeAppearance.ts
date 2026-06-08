export const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#1e293b',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    borderRadius: '8px',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '14px',
  },
  rules: {
    '.Input': { border: '1px solid #334155', backgroundColor: '#1e293b', padding: '8px 12px' },
    '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none', outline: 'none' },
    '.Label': { color: '#cbd5e1', fontSize: '12px' },
    '.Tab': { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', backgroundColor: '#1e293b', border: '1px solid #334155' },
    '.Tab--selected': { backgroundColor: '#1e293b', border: '1px solid #3b82f6', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: 'none' },
  } as Record<string, Record<string, string>>,
};

export const STRIPE_FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
];
