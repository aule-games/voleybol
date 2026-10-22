export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export function button(text: string, action: () => void, className = 'button'): HTMLButtonElement {
  const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function link(text: string, href: string, className = ''): HTMLAnchorElement {
  const node = el('a', text, className); node.href = href; return node;
}
export function notice(text: string, warning = false): HTMLElement { return el('p', text, warning ? 'notice warning' : 'notice'); }
export function heading(text: string, eyebrow: string): HTMLElement {
  const block = el('div', undefined, 'page-heading'); block.append(el('p', eyebrow, 'eyebrow'));
  const title = el('h1', text); title.tabIndex = -1; block.append(title); return block;
}
export function focus(id: string) { document.getElementById(id)?.focus(); }
export function announce(text: string) { const region = document.getElementById('announcer'); if (region && region.textContent !== text) region.textContent = text; }
export function dateTR(utc: string): string { return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(utc)) + ' TSİ'; }
