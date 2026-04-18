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

  const [activeLevel, setActiveLevel] = useState(() => {
    return LEVELS.find(l => loadedLevels?.has(l)) ?? 'A1'
  });

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

  // ── Ana ekran: horizontal level nav ──
  return (
    <div className="page fp-browse">
      {/* Günlük çalışma butonu */}
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

      {/* ── Level Navigator ── */}
      <div className="fp-level-nav">
        {LEVELS.map(level => {
          const unlocked = isLevelUnlocked(level, categories, vocabulary, progress, threshold);
          const loaded = loadedLevels?.has(level) ?? false;
          const levelPct = loaded ? Math.round(getLevelProgress(level, categories, vocabulary, progress) * 100) : 0;
          const color = levelColors[level] ?? 'var(--primary)';
          const isActive = activeLevel === level;
          return (
            <button
              key={level}
              className={`fp-lvl-pill${isActive ? ' active' : ''}${!unlocked ? ' locked' : ''}`}
              style={isActive ? { background: color, borderColor: color } : {}}
              onClick={() => {
                if (!unlocked) return;
                setActiveLevel(level);
                if (!loadedLevels?.has(level)) onLoadLevel?.(level);
              }}
              disabled={!unlocked}
            >
              {unlocked ? level : '—'}
              {unlocked && loaded && (
                <span className="fp-lvl-pct">{levelPct}%</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Seçili Level'ın Kategorileri ── */}
      {(() => {
        const loaded = loadedLevels?.has(activeLevel) ?? false;
        const color = levelColors[activeLevel] ?? 'var(--primary)';
        const levelCats = categories.filter(c => c.level === activeLevel);

        let cumulativeCatIndex = 0;
        let visibleCats = levelCats;
        if (unlockedCatCount !== Infinity) {
          LEVELS.forEach(l => {
            const cats = categories.filter(c => c.level === l);
            if (l === activeLevel) {
              const remaining = Math.max(0, unlockedCatCount - cumulativeCatIndex);
              visibleCats = cats.slice(0, remaining);
            } else {
              cumulativeCatIndex += cats.length;
            }
          });
        }

        if (!loaded) return (
          <div className="fp-loading">Yükleniyor…</div>
        );

        return (
          <div className="fp-cat-list">
            {visibleCats.map(cat => {
              const total = vocabulary[cat.id]?.length ?? 0;
              const known = getKnownCount(progress[cat.id]);
              const due = getDueCount(vocabulary[cat.id], wordKey, progress[cat.id]);
              const pct = total > 0 ? Math.round((known / total) * 100) : 0;
              return (
                <button key={cat.id} className="fp-cat-row" onClick={() => startCategory(cat.id)}>
                  <span className="fp-cat-emoji">{cat.emoji}</span>
                  <div className="fp-cat-info">
                    <div className="fp-cat-top">
                      <span className="fp-cat-label">{cat.label}</span>
                      {due > 0 && <span className="fp-cat-due">tekrar</span>}
                    </div>
                    <div className="fp-cat-bar-track">
                      <div className="fp-cat-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <span className="fp-cat-pct">{pct}%</span>
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
