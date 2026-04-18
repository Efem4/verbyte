/**
 * audioConfig.js
 * R2 ses URL yapılandırması
 */

export const AUDIO_BASE = 'https://pub-3b58e55d31da4838b79a6a178e8279bd.r2.dev';

/**
 * Kelime ID'sinden ses URL'i üret
 * @param {string} lang  - 'fr' | 'en' | 'de'
 * @param {string} wordId - örn: 'fr_greetings_bonjour_000'
 * @returns {string} tam URL
 */
export function getAudioUrl(lang, wordId) {
  return `${AUDIO_BASE}/audio/${lang}/${wordId}.mp3`;
}

export function getSentenceAudioUrl(lang, sentenceId) {
  return `${AUDIO_BASE}/audio/${lang}/sentences/${sentenceId}.mp3`;
}
