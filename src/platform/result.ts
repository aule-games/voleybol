export type ErrorCode = 'CONTENT_UNAVAILABLE' | 'CONTENT_STALE' | 'CONTENT_INVALID' | 'CONTENT_SUPERSEDED' | 'CONTENT_ROLLBACK' | 'PREDICTION_LOCKED' | 'PREDICTION_CHANGED' | 'PREDICTION_UNAVAILABLE' | 'OFFLINE' | 'LINEUP_INVALID' | 'LINK_INVALID' | 'QUIZ_UPDATED' | 'QUIZ_INVALID' | 'STORAGE_CONFLICT' | 'STORAGE_MEMORY' | 'STORAGE_CLEAR_INCOMPLETE' | 'SHARE_EXPIRED' | 'SHARE_OVERFLOW' | 'SHARE_FAILED';
export interface Diagnostic { code: ErrorCode; docs: string; operation: 'content' | 'prediction' | 'lineup' | 'quiz' | 'storage' | 'share' | 'route'; sideEffects: 'none' | 'partial' | 'complete' | 'unknown'; retry: 'explicit' | 'after-update' | 'none' }
export type Result<T> = { ok: true; value: T } | { ok: false; error: Diagnostic };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export function fail(code: ErrorCode, operation: Diagnostic['operation'], sideEffects: Diagnostic['sideEffects'] = 'none'): { ok: false; error: Diagnostic } {
  return { ok: false, error: { code, operation, sideEffects, docs: `docs/development.md#${code.toLowerCase().replaceAll('_', '-')}`, retry: code === 'CONTENT_STALE' ? 'after-update' : 'explicit' } };
}
export const COPY: Record<ErrorCode, string> = {
  CONTENT_UNAVAILABLE: 'İçerik doğrulanamadı. Bağlantını kontrol edip Yenile’ye bas. Tahminin kaydedilmedi.',
  CONTENT_STALE: 'İçeriğin doğrulama süresi doldu. Yeni içerik yayımlanana kadar tahmin ve dışa aktarım kapalı.',
  CONTENT_INVALID: 'İçerik güvenle açılamadı. Diğer oyunları deneyebilirsin.',
  CONTENT_SUPERSEDED: 'İşlem sırasında ekran değişti. Seçimini kontrol edip yeniden onayla.',
  CONTENT_ROLLBACK: 'Eski bir içerik sürümü geldi. Güvenlik için işlem durduruldu.',
  PREDICTION_LOCKED: 'Tahmin süresi doldu. Kayıtlar okunabilir; yeni tahmin kaydedilemez.',
  PREDICTION_CHANGED: 'Maç veya seçim değişti. Yeni bilgiyi kontrol edip tekrar onayla.',
  PREDICTION_UNAVAILABLE: 'Bu maç tahmine açık değil. Kaydedilmiş tahminin korunuyor.',
  OFFLINE: 'Çevrimdışısın. Tahmin kaydedilmez; bağlantı gelince Yenile’ye bas. Otomatik gönderim yapılmaz.',
  LINEUP_INVALID: 'Her rolü tamamla: yedi farklı oyuncu gerekiyor.',
  LINK_INVALID: 'Bu takım bağlantısı geçersiz veya artık kullanılamıyor. Kendi takımını kurabilirsin.',
  QUIZ_UPDATED: 'Quiz güncellendi. Bu deneme durduruldu; yeni sorularla açıkça yeniden başla.',
  QUIZ_INVALID: 'Bu sonuç artık puanlanamıyor. Soru kaldırılmış veya yanıt eşleştirilemiyor.',
  STORAGE_CONFLICT: 'Aynı kayıt başka bir sekmede de değişti. Hiçbir sürüm silinmedi. Seçimini yeniden onayla.',
  STORAGE_MEMORY: 'Yalnızca bu oturumda kullanılabilir; kayıt cihazda saklanmıyor.',
  STORAGE_CLEAR_INCOMPLETE: 'Tüm kayıtların silindiği doğrulanamadı. Bazı kayıtlar kalmış olabilir.',
  SHARE_EXPIRED: 'Önizlemenin doğrulaması sona erdi. Yeniden hazırla; hiçbir paylaşım yapılmadı.',
  SHARE_OVERFLOW: 'Oyuncu adları görsele eksiksiz sığmıyor. Metni veya bağlantıyı kullan.',
  SHARE_FAILED: 'İşlemin sonucu doğrulanamadı. Tekrar denemeden önce hedef uygulamayı kontrol et.',
};
