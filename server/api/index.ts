import app from '../src/app';

// vercel.json's builds[].config.maxDuration is not honored for legacy @vercel/node
// builds — the documented mechanism is this exported `config`, read directly from
// the function file. Needed for the Places search/generate flow (pagination +
// website scraping can take longer than the 10s default).
export const config = { maxDuration: 60 };

export default app;
