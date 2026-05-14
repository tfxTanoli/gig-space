const DB_URL = process.env.VITE_FIREBASE_DATABASE_URL;
const SITE = 'https://gig-space.vercel.app';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const id = req.query.id;

  if (!id) {
    res.redirect(302, SITE);
    return;
  }

  const servicePageUrl = `${SITE}/service-detail?id=${id}`;

  let service = null;
  try {
    const r = await fetch(`${DB_URL}/services/${id}.json`);
    if (r.ok) service = await r.json();
  } catch {}

  if (!service || service.status !== 'active') {
    res.redirect(302, servicePageUrl);
    return;
  }

  const title = service.title || 'Service on GigSpace';
  const rawDesc = service.description
    ? service.description.replace(/\s+/g, ' ').trim().slice(0, 160)
    : `${service.sellerName ?? 'A seller'} offers this service on GigSpace.`;
  const priceLabel = `$${service.priceMin}${service.priceMax ? `–$${service.priceMax}` : ''} ${service.priceType === 'per_hour' ? '/hr' : '/project'}`;
  const description = `${priceLabel} · ${rawDesc}`;
  const image = Array.isArray(service.images) ? service.images[0] : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} | GigSpace</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="GigSpace">
  <meta property="og:url"         content="${esc(servicePageUrl)}">
  <meta property="og:title"       content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${image ? `<meta property="og:image"       content="${esc(image)}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  ${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}

  <!-- Redirect real users to the SPA immediately -->
  <script>window.location.replace('${servicePageUrl}');</script>
</head>
<body>
  <p>Redirecting to <a href="${esc(servicePageUrl)}">${esc(title)}</a>…</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.status(200).send(html);
}
