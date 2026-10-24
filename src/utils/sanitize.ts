const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span']);

// Removed together with everything inside them, as the server renderer does
// (src/seo/render.ts sanitizeRichText), so a crawler and a visitor see the
// same text: unwrapping a <style> would show its CSS as words on the page.
const DROPPED_TAGS = 'script, style, iframe, object, embed, template, noscript, textarea, title';

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  // Parse into an inert document. A detached <div>'s innerHTML is not inert:
  // the browser starts loading <img src=x onerror=…> the moment it's parsed,
  // and the handler runs even though the element is removed a moment later.
  const doc = new DOMParser().parseFromString(dirty, 'text/html');
  const root = doc.body;
  root.querySelectorAll(DROPPED_TAGS).forEach((node) => node.remove());
  root.querySelectorAll('*').forEach((node) => {
    if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
      node.replaceWith(...Array.from(node.childNodes));
    } else {
      Array.from(node.attributes).forEach((a) => node.removeAttribute(a.name));
    }
  });
  return root.innerHTML;
}
