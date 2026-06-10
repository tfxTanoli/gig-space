export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { code, client_id, redirect_uri, code_verifier } = req.body || {};

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return res.status(400).json({ error: 'missing_params' });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
      code_verifier,
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok || tokens.error) {
    return res.status(400).json({
      error: tokens.error,
      error_description: tokens.error_description,
    });
  }

  return res.json({ id_token: tokens.id_token, access_token: tokens.access_token });
}
