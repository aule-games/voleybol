/** Small reviewed catalogue; content cannot supply arbitrary asset paths. */
export const CLUBS = {
  vakifbank: { name: 'VakıfBank', mark: 'marks/clubs/vakifbank.svg' },
  eczacibasi: { name: 'Eczacıbaşı Peron İstanbul', mark: 'marks/clubs/eczacibasi.png' },
  fenerbahce: { name: 'Fenerbahçe Medicana', mark: 'marks/clubs/fenerbahce.png' },
  galatasaray: { name: 'Galatasaray Daikin', mark: 'marks/clubs/galatasaray.png' },
  thy: { name: 'Türk Hava Yolları', mark: 'marks/clubs/thy.png' },
} as const;
export const COUNTRIES = { TR: { name: 'Türkiye', mark: 'marks/countries/tr.svg' } } as const;
export function isLoopback(url: URL): boolean {
  return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}
/** Deliberate preview target, not authentication or a copyright permission check. */
export function isPublicPreviewTarget(url: URL): boolean {
  return isLoopback(url) || url.href === 'https://aule-games.github.io/voleybol/content.json';
}
export function officialSource(value: unknown, kind: 'player' | 'quiz'): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
    return kind === 'player'
      ? url.hostname === 'sultanlar.volleystation.com' && /^\/en\/players\/\d+\/$/.test(url.pathname)
      : (url.hostname === 'tvf.org.tr' && url.pathname.startsWith('/icerik/'))
        || (url.hostname === 'www.vakifbanksporkulubu.com' && url.pathname.startsWith('/tr/haber-detay/'));
  } catch { return false; }
}
