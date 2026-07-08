export const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#1e293b',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    borderRadius: '8px',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    // 16px matches our other form inputs and prevents iOS Safari from
    // zooming in when a card field is focused.
    fontSizeBase: '16px',
  },
  rules: {
    '.Input': { border: '1px solid #334155', backgroundColor: '#1e293b', padding: '10px 16px' },
    '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none', outline: 'none' },
    '.Label': { color: '#cbd5e1', fontSize: '13px' },
    '.Tab': { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', backgroundColor: '#1e293b', border: '1px solid #334155' },
    '.Tab--selected': { backgroundColor: '#1e293b', border: '1px solid #3b82f6', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: 'none' },
  } as Record<string, Record<string, string>>,
};

export const STRIPE_FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
];
