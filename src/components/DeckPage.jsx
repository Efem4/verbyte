import { useState } from 'react';
import Flashcard from './Flashcard';
import { buildQueue } from '../utils/srs';
import './DeckPage.css';

export default function DeckPage({
  deckState,
  langConfig,
  progress,
  onProgress,
  onStudy,
  onBack,
  onLoadLevel,
}) {
  const { category, words } = deckState ?? {};
  const catProgress = progress?.[category?.id] ?? {};

  const [queue] = useState(() =>
    langConfig ? buildQueue(words, langConfig.wordKey, catProgress) : []
  );
  const [idx, setIdx] = useState(0);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionMissed, setSessionMissed] = useState(0);
  const [combo, setCombo] = useState(0);

  if (!langConfig) return null;

  const currentWord = queue[idx] !== undefined ? words[queue[idx]] : null;
  const remaining = queue.length - idx;
  const progressPct = queue.length > 0
    ? Math.round((idx / queue.length) * 100)
    : 100;

  function isNew(word) {
    const entry = catProgress?.[word[langConfig.wordKey]];
    return !entry || (entry.reps ?? 0) === 0;
  }

  function handleKnow(timeMs, wasFlipped) {
    if (!currentWord) return;
    onProgress(category.id, currentWord, true, isNew(currentWord));
    if (onStudy) onStudy(currentWord);
    setSessionKnown(k => k + 1);
    setCombo(c => c + 1);
    setIdx(i => i + 1);
  }

  function handleSkip() {
    if (!currentWord) return;
    onProgress(category.id, currentWord, false, isNew(currentWord));
    setSessionMissed(m => m + 1);
    setCombo(0);
    setIdx(i => i + 1);
  }

  const total = sessionKnown + sessionMissed;
  const accuracy = total > 0 ? Math.round((sessionKnown / total) * 100) : 0;

  function getDoneEmoji() {
    if (accuracy >= 90) return '🏆';
    if (accuracy >= 70) return '🎉';
    if (accuracy >= 50) return '💪';
    return '📚';
  }

  return (
    <div className="deck-page">
      {/* Header */}
      <div className="deck-header">
        <button className="back-btn" onClick={onBack}>← Geri</button>
        <span className="deck-header-emoji">{category.emoji}</span>
        <span className="deck-header-label">{category.label}</span>
        {currentWord && (
          <span className="deck-header-count">{remaining} kart kaldı</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="deck-progress-bar">
        <div
          className="deck-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Content */}
      {currentWord ? (
        <>
          <div className="deck-content">
            <Flashcard
              word={currentWord}
              wordKey={langConfig.wordKey}
              languageLabel={langConfig.languageLabel}
              onKnow={(timeMs, wasFlipped) => handleKnow(timeMs, wasFlipped)}
              onSkip={() => handleSkip()}
              total={remaining}
              combo={combo}
              levelColor={category.levelColor}
              isNew={isNew(currentWord)}
            />
          </div>

        </>
      ) : (
        /* Done screen */
        <div className="deck-content deck-content--done">
          <div className="deck-done">
            <div className="deck-done-emoji">{getDoneEmoji()}</div>
            <div className="deck-done-title">Tebrikler!</div>
            <div className="deck-done-sub">
              {total} kelime çalıştın
            </div>
            <div className="deck-done-stats">
              <div className="deck-done-stat">
                <span className="stat-num green">{sessionKnown}</span>
                <span className="deck-done-stat-lbl">Bildim</span>
              </div>
              <div className="deck-done-stat">
                <span className="stat-num red">{sessionMissed}</span>
                <span className="deck-done-stat-lbl">Bilmedim</span>
              </div>
              <div className="deck-done-stat">
                <span className="stat-num">{accuracy}%</span>
                <span className="deck-done-stat-lbl">Doğruluk</span>
              </div>
            </div>
            <div className="deck-done-actions">
              <button className="btn-secondary" onClick={onBack}>
                Geri Dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
