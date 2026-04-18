import { useEffect, useState } from 'react';
import SentenceFlashcard from './SentenceFlashcard';
import { loadSentenceLevel } from '../config/languageRegistry';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function migrateSentProgress(raw) {
  if (!raw) return {};
  const result = {};
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val === 'number') {
      // old: count > 0 means was known
      if (val > 0) {
        result[id] = { interval: 1, due: Date.now() + 24*60*60*1000, reps: val };
      }
    } else if (val && typeof val === 'object') {
      result[id] = val;
    }
  }
  return result;
}

function loadSentProgress(langCode) {
  try {
    const raw = JSON.parse(localStorage.getItem(`${langCode}_sent_progress`)) || {};
    return migrateSentProgress(raw);
  } catch { return {}; }
}
function saveSentProgress(langCode, p) {
  localStorage.setItem(`${langCode}_sent_progress`, JSON.stringify(p));
}

function updateSentEntry(prev, sentenceId) {
  const e = prev[sentenceId] ?? { interval: 0, due: 0, reps: 0 };
  const interval = e.interval === 0 ? 1 :
                   e.interval === 1 ? 3 :
                   Math.round(e.interval * 2.1);
  const due = Date.now() + interval * 24 * 60 * 60 * 1000;
  return { ...prev, [sentenceId]: { interval, due, reps: (e.reps || 0) + 1 } };
}

function failSentEntry(prev, sentenceId) {
  const e = prev[sentenceId] ?? { interval: 0, due: 0, reps: 0 };
  return { ...prev, [sentenceId]: { interval: 0, due: Date.now(), reps: e.reps || 0 } };
}

function buildSentQueue(sentences, sentProgress) {
  const now = Date.now();
  const due = sentences.filter(s => {
    const e = sentProgress[s.id];
    return e && e.due <= now;
  });
  const newSents = sentences.filter(s => !sentProgress[s.id]);
  const maxNew = Math.min(5, newSents.length);
  const picked = [...shuffle(due), ...shuffle(newSents).slice(0, maxNew)];
  return picked.length > 0 ? picked : shuffle(sentences);
}

export default function SentenceFlashcardPage({ langConfig }) {
  const langCode = langConfig?.wordKey ?? null;

  const [loadedSentLevels, setLoadedSentLevels] = useState(new Set());
  const [sentProgress, setSentProgress] = useState(() => langCode ? loadSentProgress(langCode) : {});
  const [activeLevel, setActiveLevel] = useState(() => {
    return LEVELS.find(l => langConfig?.loadedLevels?.has(l)) ?? 'A1';
  });
  const [selectedCat, setSelectedCat] = useState(null);
  const [queue, setQueue] = useState([]);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionMissed, setSessionMissed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [phase, setPhase] = useState('browse');

  // Otomatik olarak yüklü word levelları için cümle verisi yükle
  useEffect(() => {
    if (!langConfig) return;
    const { loadedLevels } = langConfig;
    const toLoad = [...loadedLevels].filter(l => !loadedSentLevels.has(l));
    if (toLoad.length === 0) return;
    Promise.all(toLoad.map(l => loadSentenceLevel(langCode, l))).then(() => {
      setLoadedSentLevels(new Set([...loadedSentLevels, ...toLoad]));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig?.loadedLevels?.size]);

  if (!langConfig) return null;
  const { sentenceCategories, categories, levelColors, wordKey, languageLabel, loadedLevels } = langConfig;

  // Kategori için level bul
  function getCatLevel(catId) {
    return categories.find(c => c.id === catId)?.level ?? 'A1';
  }

  // Seviyeye ait cümle kategorileri
  function getSentCatsForLevel(level) {
    return sentenceCategories.filter(sc => getCatLevel(sc.id) === level);
  }

  function startCategory(cat) {
    const all = cat.sentences ?? [];
    const q = buildSentQueue(all, sentProgress);
    setSelectedCat(cat);
    setQueue(q);
    setSessionKnown(0);
    setSessionMissed(0);
    setCombo(0);
    setPhase('studying');
  }

  function handleKnow() {
    if (!queue.length || !selectedCat) return;
    const sent = queue[0];
    const updated = updateSentEntry(sentProgress, sent.id);
    setSentProgress(updated);
    saveSentProgress(langCode, updated);
    const nc = combo + 1;
    setCombo(nc);
    setSessionKnown(n => n + 1);
    const next = queue.slice(1);
    if (next.length === 0) setPhase('done');
    else setQueue(next);
  }

  function handleSkip() {
    if (!queue.length || !selectedCat) return;
    setCombo(0);
    const failedSent = queue[0];
    const updated = failSentEntry(sentProgress, failedSent.id);
    setSentProgress(updated);
    saveSentProgress(langCode, updated);
    setSessionMissed(n => n + 1);
    const next = queue.slice(1);
    if (next.length === 0) setPhase('done');
    else setQueue(next);
  }

  function handleSelectLevel(level) {
    setActiveLevel(level);
    if (!loadedSentLevels.has(level) && loadedLevels.has(level)) {
      loadSentenceLevel(langCode, level).then(() => {
        setLoadedSentLevels(prev => new Set([...prev, level]));
      });
    }
  }

  // ── Kart çalışma ekranı ──
  if (phase === 'studying' && queue.length > 0) {
    const sentence = queue[0];
    const cat = selectedCat;
    const catLevel = getCatLevel(cat?.id);
    const color = levelColors[catLevel];
    const isNew = !sentProgress[sentence.id];

    return (
      <div className="page page--deck">
        <div className="deck-header">
          <button className="back-btn" onClick={() => setPhase('browse')}>← Geri</button>
          <div className="deck-title">
            <span>{cat?.emoji}</span>
            <span>{cat?.label}</span>
            <span className="lsc-badge" style={{ background: color }}>{catLevel}</span>
          </div>
        </div>
        <SentenceFlashcard
          key={sentence.id}
          sentence={sentence}
          wordKey={wordKey}
          languageLabel={languageLabel}
          onKnow={handleKnow}
          onSkip={handleSkip}
          total={queue.length}
          combo={combo}
          levelColor={color}
          isNew={isNew}
        />
      </div>
    );
  }

  // ── Tur bitti ──
  if (phase === 'done') {
    const cat = selectedCat;
    const total = sessionKnown + sessionMissed;
    const accuracy = total > 0 ? Math.round((sessionKnown / total) * 100) : 0;
    return (
      <div className="page">
        <div className="session-result">
          <div className="result-emoji">{accuracy >= 70 ? '🎉' : '💪'}</div>
          <h2>{accuracy >= 70 ? 'Harika!' : 'Devam et!'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{cat?.emoji} {cat?.label}</p>
          <div className="result-stats">
            <div className="result-stat">
              <span className="stat-num green">{sessionKnown}</span>
              <span className="stat-label">Bildim</span>
            </div>
            <div className="result-stat">
              <span className="stat-num red">{sessionMissed}</span>
              <span className="stat-label">Bilmedim</span>
            </div>
            <div className="result-stat">
              <span className="stat-num" style={{ color: accuracy >= 70 ? '#34D399' : '#F87171' }}>%{accuracy}</span>
              <span className="stat-label">Doğru</span>
            </div>
          </div>
          <div className="result-actions">
            <button className="btn-primary" onClick={() => startCategory(selectedCat)}>Tekrar Çalış</button>
            <button className="btn-secondary" onClick={() => setPhase('browse')}>Kategorilere Dön</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ana ekran: level navigator ──
  return (
    <div className="page fp-browse">
      {/* Level pill navigator */}
      <div className="fp-level-nav">
        {LEVELS.map(level => {
          const isAvail = loadedLevels.has(level);
          if (!isAvail) return null;
          const isSentLoaded = loadedSentLevels.has(level);
          const color = levelColors[level] ?? 'var(--primary)';
          const isActive = activeLevel === level;

          const sentCats = getSentCatsForLevel(level);
          const totalSents = sentCats.reduce((s, c) => s + (c.sentences?.length ?? 0), 0);
          const knownSents = sentCats.reduce((s, c) =>
            s + (c.sentences?.filter(sent => (sentProgress[sent.id]?.reps ?? 0) > 0).length ?? 0), 0
          );
          const levelPct = isSentLoaded && totalSents > 0
            ? Math.round((knownSents / totalSents) * 100)
            : null;

          return (
            <button
              key={level}
              className={`fp-lvl-pill${isActive ? ' active' : ''}`}
              style={isActive ? { background: color, borderColor: color } : {}}
              onClick={() => handleSelectLevel(level)}
            >
              {level}
              {levelPct !== null && (
                <span className="fp-lvl-pct">{levelPct}%</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Seçili level'ın cümle kategorileri */}
      {(() => {
        const isSentLoaded = loadedSentLevels.has(activeLevel);
        const color = levelColors[activeLevel] ?? 'var(--primary)';
        const sentCats = getSentCatsForLevel(activeLevel);

        if (!isSentLoaded) {
          return <div className="fp-loading">Yükleniyor…</div>;
        }

        if (sentCats.length === 0) {
          return (
            <div className="fp-loading">Bu seviyede cümle kategorisi yok.</div>
          );
        }

        return (
          <div className="fp-cat-list">
            {sentCats.map(cat => {
              const total = cat.sentences?.length ?? 0;
              const known = cat.sentences?.filter(s => (sentProgress[s.id]?.reps ?? 0) > 0).length ?? 0;
              const due = cat.sentences?.filter(s => {
                const e = sentProgress[s.id];
                return e && e.due <= Date.now();
              }).length ?? 0;
              const pct = total > 0 ? Math.round((known / total) * 100) : 0;
              return (
                <button key={cat.id} className="fp-cat-row" onClick={() => startCategory(cat)}>
                  <span className="fp-cat-emoji">{cat.emoji}</span>
                  <div className="fp-cat-info">
                    <div className="fp-cat-top">
                      <span className="fp-cat-label">{cat.label}</span>
                      {due > 0 && <span className="fp-cat-due">tekrar</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} cümle</span>
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
