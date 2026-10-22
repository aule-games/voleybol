import type { Content, Player } from '../domain/types.ts';
import { SLOT_LABELS } from '../domain/types.ts';
import { currentPolicy } from '../data/validate.ts';
import { fail, ok } from './result.ts';
import type { ErrorCode, Result } from './result.ts';

export interface PreparedTeam { url: string; text: string; file: File | null; blobUrl: string | null; expiresAt: number; revision: number; rightsRevision: number; selection: string; pngError: ErrorCode | null }
export function preparedValid(prepared: PreparedTeam, content: Content | null, selection: string, now: number, online: boolean): boolean {
  return !!content && online && currentPolicy(content, now) && now < prepared.expiresAt && content.revision === prepared.revision && content.rightsRevision === prepared.rightsRevision && prepared.selection === selection;
}
export function lineupText(players: Player[], real = false): string { return `${real ? 'Yerel test · Gerçek oyuncularla hayal takımım' : 'Kurgusal demo · Hayalimdeki takım'}\n${players.map((p, i) => `${SLOT_LABELS[i]}: ${p.name}`).join('\n')}\nAltı saha yeri + ayrı libero. Resmî rotasyon değildir.`; }
export function wrapName(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, name: string, width: number): string[] | null {
  const lines: string[] = []; let line = '';
  for (const word of name.split(/\s+/)) {
    if (ctx.measureText(word).width > width) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > width) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length <= 3 ? lines : null;
}
export async function renderTeamPng(players: Player[], asOf: string, signal?: AbortSignal, real = false): Promise<Result<File>> {
  if (signal?.aborted) return fail('SHARE_EXPIRED', 'share');
  if (players.length !== 7) return fail('LINEUP_INVALID', 'share');
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  try {
    const ctx = canvas.getContext('2d'); if (!ctx) return fail('SHARE_FAILED', 'share');
    ctx.fillStyle = '#FFF9F2'; ctx.fillRect(0, 0, 1080, 1350);
    // Italic f overhangs its origin; inset it so visible ink stays inside the 64px safe area.
    ctx.fillStyle = '#48263D'; ctx.font = 'italic bold 62px Georgia, serif'; ctx.fillText('filedeyiz.', 82, 121);
    ctx.fillStyle = '#B04B3C'; ctx.fillRect(64, 156, 68, 5);
    ctx.fillStyle = '#48263D'; ctx.font = 'italic 76px Georgia, serif'; ctx.fillText('Benim yedilim.', 64, 253);
    ctx.font = '25px system-ui, sans-serif'; ctx.fillText(real ? 'YEREL TEST · GERÇEK OYUNCULAR' : 'KURGUSAL DEMO · GEÇİCİ İSİM', 64, 300);
    ctx.fillStyle = '#48263D'; ctx.fillRect(64, 340, 952, 580);
    ctx.strokeStyle = '#B897AA'; ctx.lineWidth = 2; ctx.strokeRect(79, 355, 922, 550);
    ctx.beginPath(); ctx.moveTo(79, 628); ctx.lineTo(1001, 628); ctx.moveTo(79, 634); ctx.lineTo(1001, 634); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const p = players[i]!; const libero = i === 6;
      const x = libero ? 64 : 64 + (i % 3) * (952 / 3); const y = libero ? 952 : 340 + Math.floor(i / 3) * 290;
      const width = libero ? 952 : 952 / 3;
      if (libero) { ctx.fillStyle = '#EEE3ED'; ctx.fillRect(x, y, width, 150); }
      const center = x + width / 2;
      // These are decorative slot numbers, not athlete shirt numbers.
      const markX = libero ? x + 45 : center - 25;
      const markY = y + (libero ? 43 : 24);
      ctx.fillStyle = libero ? '#48263D' : '#EF8E77';
      ctx.beginPath();
      ctx.moveTo(markX + 10, markY); ctx.lineTo(markX + 20, markY + 6); ctx.lineTo(markX + 30, markY + 6); ctx.lineTo(markX + 40, markY);
      ctx.lineTo(markX + 55, markY + 14); ctx.lineTo(markX + 47, markY + 28); ctx.lineTo(markX + 42, markY + 24);
      ctx.lineTo(markX + 42, markY + 62); ctx.lineTo(markX + 8, markY + 62); ctx.lineTo(markX + 8, markY + 24);
      ctx.lineTo(markX + 3, markY + 28); ctx.lineTo(markX - 5, markY + 14); ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = libero ? '#FFF9F2' : '#48263D'; ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(libero ? 'L' : String(i + 1).padStart(2, '0'), markX + 25, markY + 41);
      ctx.fillStyle = libero ? '#48263D' : '#FFF9F2'; let lines: string[] | null = null; let font = 44;
      for (; font >= 40; font -= 2) { ctx.font = `bold ${font}px system-ui, sans-serif`; lines = wrapName(ctx, p.name, libero ? width - 190 : width - 36); if (lines) break; }
      if (!lines || (libero && lines.length > 1)) return fail('SHARE_OVERFLOW', 'share');
      ctx.textAlign = libero ? 'left' : 'center';
      const nameX = libero ? x + 150 : center;
      for (let line = 0; line < lines.length; line++) ctx.fillText(lines[line]!, nameX, y + (libero ? 65 : 130) + line * (font + 7));
      ctx.font = '27px system-ui, sans-serif'; ctx.fillStyle = libero ? '#695964' : '#E4CFDD';
      ctx.fillText(SLOT_LABELS[i]!, nameX, libero ? y + 109 : y + 260);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#48263D'; ctx.font = 'italic 36px Georgia, serif';
    ctx.fillText('Altı saha yeri. Bir libero. Benim seçimim.', 64, 1171);
    ctx.fillStyle = '#695964'; ctx.font = '25px system-ui, sans-serif';
    ctx.fillText(`${real ? 'Seçilmiş kadro' : 'Örnek kadro'} · ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul' }).format(new Date(asOf))} · Resmî rotasyon değildir.`, 64, 1222);
    ctx.fillText(real ? 'Taraftar seçimi. Resmî takım veya kulüp iş birliği değildir.' : 'Oyuncu adları ve bu görsel demo için oluşturulmuştur.', 64, 1264);
    // Native encoding cannot be stopped, but our wait, buffer and late callback are bounded.
    const result = await new Promise<Result<Blob>>(resolve => {
      let settled = false;
      const finish = (result: Result<Blob>) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); resolve(result);
      };
      const cancel = () => finish(fail('SHARE_EXPIRED', 'share'));
      const timer = setTimeout(() => finish(fail('SHARE_FAILED', 'share')), 5000);
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      try { canvas.toBlob(blob => finish(blob ? ok(blob) : fail('SHARE_FAILED', 'share')), 'image/png'); }
      catch { finish(fail('SHARE_FAILED', 'share')); }
    });
    if (signal?.aborted) return fail('SHARE_EXPIRED', 'share');
    return result.ok ? ok(new File([result.value], real ? 'hayalimdeki-takim-yerel.png' : 'hayalimdeki-takim-demo.png', { type: 'image/png' })) : result;
  } catch { return fail('SHARE_FAILED', 'share'); }
  finally { canvas.width = canvas.height = 0; }
}
