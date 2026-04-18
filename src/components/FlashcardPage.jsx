import { useState } from 'react';
import { buildSmartQueue, getDueCount } from '../utils/srs';
import { getUnlockedCategoryCount } from '../utils/categoryUnlock';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

function getKnownCount(catProgress) {
  if (!catProgress || Array.isArray(catProgress)) return 0;
  return Object.keys(catProgress).length;
}

function getLevelProgress(level, categories, vocabulary, progress) {
  const cats = categories.filter(c => c.level === level);
  const total = cats.reduce((s, c) => s + (vocabulary[c.id]?.length ?? 0), 0);
  const known = cats.reduce((s, c) => s + getKnownCount(progress[c.id]), 0);
  return total > 0 ? known / total : 0;
}

function isLevelUnlocked(level, categories, vocabulary, progress, threshold) {
  const idx = LEVELS.indexOf(level);
  if (idx === 0) return true;
  return getLevelProgress(LEVELS[idx - 1], categories, vocabulary, progress) >= threshold;
}

export default function FlashcardPage({ langConfig, progress, onProgress, onDeckActiveChange, onDeckStart, onStudy, onComboChange, onLoadLevel, dailyNewRemaining = 10, onSwitchToSentences, dailySlotWords = [], slotReady = false, onDailyStart, dailyGoal = 10, firstUseDate }) {
  if (!langConfig) return null;
  const { categories, vocabulary, levelColors, threshold, wordKey, languageLabel, loadedLevels } = langConfig;

  // Varsayılan açık seviye: en düşük unlocked, tamamlanmamış
  const defaultOpen = LEVELS.find(l => {
    if (!isLevelUnlocked(l, categories, vocabulary, progress, threshold)) return false;
    return getLevelProgress(l, categories, vocabulary, progress) < 1;
  }) ?? 'A1';

  const [openLevel, setOpenLevel] = useState(defaultOpen);

  // Kaç kategori gösterileceği: 7 günde 2 ekle, dailyGoal >= 20 → hepsi açık
  const resolvedFirstUse = firstUseDate
    || localStorage.getItem('verbyte_first_use')
    || new Date().toISOString();
  const unlockedCatCount = getUnlockedCategoryCount(dailyGoal, resolvedFirstUse);

  function startCategory(catId) {
    const words = vocabulary[catId];
    const catProgress = progress[catId];
    const q = buildSmartQueue(words, wordKey, catProgress, dailyNewRemaining);
    const wordsForDeck = q.map(i => words[i]);
    const catObj = categories.find(c => c.id === catId);
    const selectedCategoryObj = catObj
      ? { id: catObj.id, label: catObj.label, emoji: catObj.emoji, levelColor: levelColors[catObj.level], cefr: catObj.level }
      : { id: catId, label: catId, emoji: '📚', levelColor: undefined, cefr: undefined };
    onDeckStart?.({
      category: selectedCategoryObj,
      words: wordsForDeck,
      isDaily: false,
    });
  }

  function startDailySlot() {
    onDailyStart?.(true);
    onDeckStart?.({
      category: { id: '__daily__', label: 'Günlük Çalışma', emoji: '📅', levelColor: undefined, cefr: undefined },
      words: dailySlotWords,
      isDaily: true,
    });
  }

  function handleOpenLevel(level) {
    const unlocked = isLevelUnlocked(level, categories, vocabulary, progress, threshold);
    if (!unlocked) return;
    setOpenLevel(prev => prev === level ? null : level);
    if (!loadedLevels?.has(level)) onLoadLevel?.(level);
  }

  // ── Ana ekran: accordion ──
  return (
    <div className="page fp-browse">
      {slotReady && dailySlotWords.length > 0 && (
        <button className="daily-slot-btn" onClick={startDailySlot}>
          <span className="dsb-icon">📅</span>
          <div className="dsb-info">
            <span className="dsb-title">Günlük Çalışma</span>
            <span className="dsb-sub">{dailySlotWords.length} kart · bugün için hazırlandı</span>
          </div>
          <span className="dsb-arrow">→</span>
        </button>
      )}
      {(() => {
        // Kümülatif kategori sayacı: A1→A2→B1→... sırasıyla unlockedCatCount kadar göster
        let cumulativeCatIndex = 0;
        return LEVELS.map(level => {
          const unlocked = isLevelUnlocked(level, categories, vocabulary, progress, threshold);
          const loaded = loadedLevels?.has(level) ?? false;
          const levelPct = loaded ? Math.round(getLevelProgress(level, categories, vocabulary, progress) * 100) : 0;
          const isOpen = openLevel === level;
          const levelCats = categories.filter(c => c.level === level);
          const color = levelColors[level] ?? '#818CF8';

          // Bu level'dan kaç kategori gösterilecek
          const remaining = unlockedCatCount === Infinity
            ? levelCats.length
            : Math.max(0, unlockedCatCount - cumulativeCatIndex);
          const visibleCats = levelCats.slice(0, remaining);
          cumulativeCatIndex += levelCats.length;

          return (
            <div key={level} className={`fp-accordion${isOpen ? ' open' : ''}${!unlocked ? ' locked' : ''}`}>
              {/* Accordion header */}
              <button
                className="fp-acc-header"
                onClick={() => handleOpenLevel(level)}
                disabled={!unlocked}
              >
                <span className="fp-acc-badge" style={{ background: unlocked ? color : 'var(--text-muted)' }}>
                  {unlocked ? level : '🔒'}
                </span>
                <div className="fp-acc-bar-wrap">
                  <div className="fp-acc-bar-track">
                    <div
                      className="fp-acc-bar-fill"
                      style={{ width: `${levelPct}%`, background: color, opacity: unlocked ? 1 : 0.3 }}
                    />
                  </div>
                </div>
                <span className="fp-acc-pct" style={{ color: unlocked ? color : 'var(--text-muted)' }}>
                  {!unlocked ? '—' : loaded ? `${levelPct}%` : '…'}
                </span>
                {unlocked && (
                  <span className="fp-acc-chevron">{isOpen ? '▲' : '▼'}</span>
                )}
              </button>

              {/* Kategori listesi */}
              {isOpen && unlocked && !loaded && (
                <div className="fp-acc-body" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Yükleniyor…
                </div>
              )}
              {isOpen && unlocked && loaded && (
                <div className="fp-acc-body">
                  {visibleCats.map(cat => {
                    const total = vocabulary[cat.id]?.length ?? 0;
                    const known = getKnownCount(progress[cat.id]);
                    const due = getDueCount(vocabulary[cat.id], wordKey, progress[cat.id]);
                    const pct = total > 0 ? Math.round((known / total) * 100) : 0;

                    return (
                      <button
                        key={cat.id}
                        className="fp-cat-row"
                        onClick={() => startCategory(cat.id)}
                      >
                        <span className="fp-cat-emoji">{cat.emoji}</span>
                        <div className="fp-cat-info">
                          <div className="fp-cat-top">
                            <span className="fp-cat-label">{cat.label}</span>
                            {due > 0 && <span className="fp-cat-due">tekrar</span>}
                          </div>
                          <div className="fp-cat-bar-track">
                            <div
                              className="fp-cat-bar-fill"
                              style={{ width: `${pct}%`, background: cat.color ?? color }}
                            />
                          </div>
                        </div>
                        <span className="fp-cat-pct">{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}
