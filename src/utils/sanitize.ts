const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span']);

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const el = document.createElement('div');
  el.innerHTML = dirty;
  el.querySelectorAll('*').forEach((node) => {
    if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
      node.replaceWith(...Array.from(node.childNodes));
    } else {
      Array.from(node.attributes).forEach((a) => node.removeAttribute(a.name));
    }
  });
  return el.innerHTML;
}
