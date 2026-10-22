import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Explicit local authoring operation. Never called by dev, build, fetch or the browser.
const path = new URL('../public/content.json', import.meta.url);
let previous = 0;
try { const old = JSON.parse(await readFile(path, 'utf8')); if (old.demo !== true) throw new Error('Not demo content'); previous = Math.max(old.revision, old.rightsRevision); }
catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
const now = Date.now(); const iso = (hours = 0) => new Date(now + hours * 3_600_000).toISOString();
const players = [
  ['p1', 'Ada Örnek', 'setter'], ['p2', 'İpek Örnek', 'setter'],
  ['p3', 'Ece Örnek', 'opposite'], ['p4', 'Güneş Örnek', 'opposite'],
  ['p5', 'Duru Örnek', 'outside'], ['p6', 'Çiğdem Örnek', 'outside'], ['p7', 'Yağmur Örnek', 'outside'], ['p8', 'Öykü Örnek', 'outside'],
  ['p9', 'Selin Örnek', 'middle'], ['p10', 'İdil Örnek', 'middle'], ['p11', 'Bahar Örnek', 'middle'], ['p12', 'Ceren Örnek', 'middle'],
  ['p13', 'Defne Örnek', 'libero'], ['p14', 'Nehir Örnek', 'libero'],
].map(([id, name, role]) => ({ id, name, role }));
const questions = [
  { id: 'q1', text: 'Bu demoda yedi kişilik hayal takımında kaç pasör seçilir?', choices: ['Bir', 'İki', 'Üç', 'Dört'], correct: 0, explanation: 'Demo takım şablonunda bir pasör yeri var. İki smaçör ve iki orta oyuncu seçiliyor.' },
  { id: 'q2', text: 'Bu demoda libero, takım görselinde nerede gösterilir?', choices: ['Takımın dışında bırakılır', 'Ayrı bir libero alanında', 'İki farklı yerde', 'Kaleci alanında'], correct: 1, explanation: 'Görselde altı saha yeri ve ayrı bir libero alanı var. Bu, resmî bir rotasyon çizimi değil.' },
  { id: 'q3', text: 'Mercan – Turkuaz maçında “3-1” tahmini, bu oyunda ne anlama gelir?', choices: ['Turkuaz 3 set alır', 'Maç berabere biter', 'Mercan 3, Turkuaz 1 set alır', 'Toplam 3 sayı oynanır'], correct: 2, explanation: 'Bu oyunda skorun ilk sayısı her zaman soldaki, yani ev sahibi takıma aittir.' },
  { id: 'q4', text: 'Aynı kurgusal oyuncuyu hayal takımında kaç kez seçebilirsin?', choices: ['İki kez', 'Her yere', 'Role göre üç kez', 'Bir kez'], correct: 3, explanation: 'Yedi yer, yedi farklı oyuncuyla tamamlanır. Aynı oyuncu ikinci bir yere eklenemez.' },
  { id: 'q5', text: 'Bu prototipte tahminlerin nerede saklanır?', choices: ['Herkese açık bir sıralamada', 'Bu tarayıcıda; depolama kapalıysa yalnızca oturumda', 'Bir kulübün hesabında', 'Sosyal medya profilinde'], correct: 1, explanation: 'Hesap ve sunucu kaydı yok. Tarayıcı verileri silinebilir; bu yüzden oyun ödüllü veya rekabetçi değildir.' },
].map(q => ({ id: q.id, revision: 1, text: q.text, choices: q.choices.map((text, i) => ({ id: `${q.id}-c${i + 1}`, text })), correctId: `${q.id}-c${q.correct + 1}`, explanation: q.explanation }));
const match = (id: string, home: string, away: string, hours: number) => ({ id, home, away, startsAt: iso(hours), locksAt: iso(hours), checkedAt: iso(), state: 'scheduled', scheduleRevision: 1, reopened: false, resultRevision: 1, result: null });
const content = {
  schema: 1, demo: true, revision: previous + 1, rightsRevision: previous + 1, publishedAt: iso(), validUntil: iso(24),
  rights: { expiresAt: iso(24), withdrawnIds: [] },
  fixtures: [match('demo-match-1', 'Mercan', 'Turkuaz', 2), match('demo-match-2', 'Kehribar', 'Menekşe', 5),
    { ...match('demo-match-3', 'Turkuaz', 'Kehribar', 8), startsAt: null, locksAt: null, state: 'postponed' },
    { ...match('demo-match-4', 'Menekşe', 'Mercan', -4), state: 'final', result: '3-2' }],
  roster: { version: 'demo-v1', asOf: iso(), players }, quiz: { id: 'demo-quiz', revision: 1, questions },
};
await mkdir(new URL('../public', import.meta.url), { recursive: true });
await writeFile(path, JSON.stringify(content, null, 2) + '\n');
console.log(`Fictional content revision ${content.revision} authored. Freshness expires ${content.validUntil}. No real data or publication.`);
