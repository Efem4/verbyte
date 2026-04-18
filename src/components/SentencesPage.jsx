import { useState, useEffect, useRef } from 'react';
import { loadSentenceCategories } from '../config/languageRegistry';

const REVEAL_DELAY_WRITE = 1600;

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CHOICE_COLORS = [
  { base: '#E53E3E', light: 'rgba(229,62,62,0.18)',  border: 'rgba(229,62,62,0.5)'  },
  { base: '#3182CE', light: 'rgba(49,130,206,0.18)',  border: 'rgba(49,130,206,0.5)'  },
  { base: '#D69E2E', light: 'rgba(214,158,46,0.18)',  border: 'rgba(214,158,46,0.5)'  },
  { base: '#38A169', light: 'rgba(56,161,105,0.18)',  border: 'rgba(56,161,105,0.5)'  },
];
const SHAPES = ['▲', '◆', '●', '★'];
const REVEAL_DELAY = 1300;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cümleden rastgele bir kelime gizle, 4 şık üret
function buildFillQuestion(sentence, wordKey, allSentences) {
  const text = sentence[wordKey] ?? sentence.fr ?? sentence.en ?? '';
  if (!text) return null;
  const words = text.split(' ');
  // En az 2+ karakter olan kelimeleri tercih et
  const candidates = words
    .map((w, i) => ({ w: w.replace(/[.,!?]/g, ''), i }))
    .filter((x) => x.w.length >= 2);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const correct = pick.w;

  // Yanlış şıklar: diğer cümlelerden rastgele kelimeler
  const pool = allSentences
    .flatMap((s) => (s[wordKey] ?? s.fr ?? s.en ?? '').split(' ').map((w) => w.replace(/[.,!?]/g, '')))
    .filter((w) => w.length >= 2 && w.toLowerCase() !== correct.toLowerCase());
  const wrongPool = shuffle([...new Set(pool)]);
  const wrongs = wrongPool.slice(0, 3);

  const blanked = words.map((w, i) => (i === pick.i ? '___' : w)).join(' ');
  const choices = shuffle([correct, ...wrongs]);

  return { blanked, answer: correct, choices, tr: sentence.tr };
}

// Cümle kelimelerini karıştır
function buildSortQuestion(sentence, wordKey) {
  const text = sentence[wordKey] ?? sentence.fr ?? sentence.en ?? '';
  if (!text) return null;
  const words = text.split(' ');
  return { words: shuffle(words), answer: words, tr: sentence.tr, original: text };
}

// ── Score screen ──────────────────────────────────────────────
function ScoreScreen({ correct, wrong, onReplay, onBack }) {
  const total = correct + wrong;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="page quiz-done">
      <div className="quiz-done-emoji">
        {accuracy >= 80 ? '🏆' : accuracy >= 50 ? '🎯' : '💪'}
      </div>
      <h2 className="quiz-done-title">
        {accuracy >= 80 ? 'Harika!' : accuracy >= 50 ? 'İyi iş!' : 'Devam et!'}
      </h2>
      <div className="quiz-done-stats">
        <div className="qdone-stat">
          <span className="qdone-val green">{correct}</span>
          <span className="qdone-lbl">Doğru</span>
        </div>
        <div className="qdone-stat">
          <span className="qdone-val red">{wrong}</span>
          <span className="qdone-lbl">Yanlış</span>
        </div>
        <div className="qdone-stat">
          <span className="qdone-val">{accuracy}%</span>
          <span className="qdone-lbl">Doğruluk</span>
        </div>
      </div>
      <div className="quiz-done-actions">
        <button className="btn-primary" onClick={onReplay}>Tekrar Oyna</button>
        <button className="btn-secondary" onClick={onBack}>Mod Seçimine Dön</button>
      </div>
    </div>
  );
}

// ── Fill in the blank ─────────────────────────────────────────
function FillMode({ sentences, wordKey, onDone, count: countProp, onStudy }) {
  const isInfinite = countProp === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap((s) => s.sentences);
    const pool = shuffle(all).slice(0, isInfinite ? all.length : countProp);
    return pool.map((s) => buildFillQuestion(s, wordKey, all)).filter(Boolean);
  });
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const revealRef = useRef(null);

  useEffect(() => () => clearTimeout(revealRef.current), []);

  function handleAnswer(choice) {
    if (selected !== null) return;
    setSelected(choice);
    const isCorrect = choice === questions[current].answer;
    if (isCorrect) { setCorrect((c) => c + 1); onStudy?.(); }
    else setWrong((w) => w + 1);

    revealRef.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) {
        onDone(correct + (isCorrect ? 1 : 0), wrong + (isCorrect ? 0 : 1));
      } else {
        setCurrent(next);
        setSelected(null);
      }
    }, REVEAL_DELAY);
  }

  const q = questions[current];
  const total = questions.length;

  if (!q) {
    onDone(correct, wrong);
    return null;
  }

  return (
    <div className="quiz-play">
      <div className="quiz-topbar">
        <div className="quiz-progress-wrap">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
          </div>
          <span className="quiz-qnum">{current + 1} / {isInfinite ? '∞' : total}</span>
        </div>
      </div>

      <div className="quiz-question-card" style={{ gap: 16 }}>
        <span className="quiz-question-label">Boşluğu doldur</span>
        <span className="fill-sentence">{q.blanked}</span>
        <span className="fill-tr">{q.tr}</span>
      </div>

      <div className="quiz-choices">
        {q.choices.map((choice, i) => {
          const color = CHOICE_COLORS[i];
          const isSelected = selected === choice;
          const isCorrect = choice === q.answer;
          const revealed = selected !== null;

          let bg = color.light;
          let border = color.border;
          let opacity = 1;
          let scale = 1;

          if (revealed) {
            if (isCorrect) { bg = color.base; border = color.base; scale = 1.03; }
            else if (isSelected) { bg = 'rgba(239,68,68,0.25)'; border = '#EF4444'; }
            else { opacity = 0.3; }
          }

          return (
            <button
              key={choice}
              className="quiz-choice"
              style={{ background: bg, borderColor: border, opacity, transform: `scale(${scale})` }}
              onClick={() => handleAnswer(choice)}
              disabled={revealed}
            >
              <span className="quiz-choice-shape" style={{ color: color.base }}>{SHAPES[i]}</span>
              <span className="quiz-choice-text">{choice}</span>
              {revealed && isCorrect && <span className="quiz-choice-check">✓</span>}
              {revealed && isSelected && !isCorrect && <span className="quiz-choice-x">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Word sort ─────────────────────────────────────────────────
function SortMode({ sentences, wordKey, onDone, count: countProp, onStudy }) {
  const isInfinite = countProp === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap((s) => s.sentences);
    const pool = shuffle(all).slice(0, isInfinite ? all.length : countProp);
    return pool.map((s) => buildSortQuestion(s, wordKey)).filter(Boolean);
  });
  const [current, setCurrent] = useState(0);
  const [placed, setPlaced] = useState([]);   // seçilen kelimeler (sıralı)
  const [available, setAvailable] = useState([]); // kalan kelimeler
  const [phase, setPhase] = useState('input'); // input | correct | wrong
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const revealRef = useRef(null);

  useEffect(() => () => clearTimeout(revealRef.current), []);

  useEffect(() => {
    const words = questions[current]?.words.map((w, i) => ({ w, id: i })) ?? [];
    setAvailable(words);
    setPlaced([]);
    setPhase('input');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function pickWord(item) {
    if (phase !== 'input') return;
    setAvailable((prev) => prev.filter((x) => x.id !== item.id));
    setPlaced((prev) => [...prev, item]);
  }

  function removeWord(item) {
    if (phase !== 'input') return;
    setPlaced((prev) => prev.filter((x) => x.id !== item.id));
    setAvailable((prev) => [...prev, item]);
  }

  function checkAnswer() {
    const q = questions[current];
    const userAnswer = placed.map((x) => x.w).join(' ');
    const isCorrect = userAnswer === q.original;
    setPhase(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) { setCorrect((c) => c + 1); onStudy?.(); }
    else setWrong((w) => w + 1);

    revealRef.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) {
        onDone(correct + (isCorrect ? 1 : 0), wrong + (isCorrect ? 0 : 1));
      } else {
        setCurrent(next);
      }
    }, REVEAL_DELAY);
  }

  const q = questions[current];
  const total = questions.length;

  if (!q) {
    onDone(correct, wrong);
    return null;
  }

  const canCheck = placed.length === q.words.length;

  return (
    <div className="quiz-play">
      <div className="quiz-topbar">
        <div className="quiz-progress-wrap">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
          </div>
          <span className="quiz-qnum">{current + 1} / {isInfinite ? '∞' : total}</span>
        </div>
      </div>

      <div className="quiz-question-card">
        <span className="quiz-question-label">Cümleyi oluştur</span>
        <span className="fill-tr">{q.tr}</span>
      </div>

      {/* Placed area */}
      <div className={`sort-placed${phase === 'correct' ? ' correct' : phase === 'wrong' ? ' wrong' : ''}`}>
        {placed.length === 0
          ? <span className="sort-placeholder">Kelimelere dokun...</span>
          : placed.map((item, idx) => {
            const isRightSpot = phase === 'input' && q.answer[idx] === item.w;
            return (
              <button
                key={item.id}
                className={`sort-chip sort-chip--placed${isRightSpot ? ' sort-chip--ok' : ''}`}
                onClick={() => removeWord(item)}
              >
                {item.w}
              </button>
            );
          })
        }
      </div>

      {phase === 'wrong' && (
        <div className="sort-correct-answer">
          <span className="sort-correct-label">Doğrusu:</span>
          <span className="sort-correct-text">{q.original}</span>
        </div>
      )}

      {/* Available words */}
      <div className="sort-available">
        {available.map((item) => (
          <button key={item.id} className="sort-chip" onClick={() => pickWord(item)}>
            {item.w}
          </button>
        ))}
      </div>

      {canCheck && phase === 'input' && (
        <button className="quiz-start-btn" onClick={checkAnswer}>Kontrol Et</button>
      )}
    </div>
  );
}

// ── Write mode ────────────────────────────────────────────────
function WriteMode({ sentences, wordKey, onDone, count: countProp, onStudy }) {
  const isInfinite = countProp === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences).filter(s => s.answer);
    return shuffle(all).slice(0, isInfinite ? all.length : countProp);
  });
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('input'); // input | correct | close | wrong
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const inputRef = useRef(null);
  const revealRef = useRef(null);

  useEffect(() => () => clearTimeout(revealRef.current), []);

  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus();
  }, [current, phase]);

  function checkAnswer() {
    if (phase !== 'input' || !input.trim()) return;
    const q = questions[current];
    const userNorm = normalizeAnswer(input);
    const correctNorm = normalizeAnswer(q.answer);

    let result;
    if (userNorm === correctNorm) {
      result = 'correct';
    } else if (editDistance(userNorm, correctNorm) <= 2) {
      result = 'close';
    } else {
      result = 'wrong';
    }

    setPhase(result);
    if (result !== 'wrong') { setCorrect(c => c + 1); onStudy?.(); }
    else setWrong(w => w + 1);

    const isWrong = result === 'wrong';
    revealRef.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) {
        onDone(correct + (isWrong ? 0 : 1), wrong + (isWrong ? 1 : 0));
      } else {
        setCurrent(next);
        setInput('');
        setPhase('input');
      }
    }, REVEAL_DELAY_WRITE);
  }

  const q = questions[current];
  const total = questions.length;

  if (!q) { onDone(correct, wrong); return null; }

  // sentence text with blank, Turkish hint for the missing word
  const sentenceText = q[wordKey] ?? q.fr ?? q.en ?? '';
  const trHint = q.tip || q.tr || '';

  const phaseConfig = {
    correct: { label: '✓ Mükemmel!', color: '#34D399' },
    close:   { label: '~ Çok yakın!', color: '#FBBF24' },
    wrong:   { label: '✗ Yanlış', color: '#F87171' },
    input:   { label: 'Eksik kelimeyi yaz', color: 'var(--text-muted)' },
  };
  const cfg = phaseConfig[phase];

  return (
    <div className="quiz-play">
      <div className="quiz-topbar">
        <div className="quiz-progress-wrap">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
          </div>
          <span className="quiz-qnum">{current + 1} / {isInfinite ? '∞' : total}</span>
        </div>
      </div>

      <div className={`quiz-question-card write-card write-card--${phase}`}>
        <span className="quiz-question-label" style={{ color: cfg.color }}>{cfg.label}</span>
        {/* Sentence with blank */}
        <span className="write-sentence">{sentenceText}</span>
        {/* Turkish hint */}
        {trHint ? <span className="write-tr-hint">🇹🇷 {trHint}</span> : null}
        {/* Correct answer reveal */}
        {phase !== 'input' && (
          <div className="write-answer-reveal">
            <span className="write-answer-text" style={{ color: cfg.color }}>{q.answer}</span>
          </div>
        )}
      </div>

      <div className="write-input-row">
        <input
          ref={inputRef}
          className={`write-input write-input--${phase}`}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') checkAnswer(); }}
          placeholder="Eksik kelimeyi yaz..."
          disabled={phase !== 'input'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {phase === 'input' && (
          <button
            className="write-submit"
            onClick={checkAnswer}
            disabled={!input.trim()}
          >
            →
          </button>
        )}
      </div>

      {phase === 'input' && (
        <p className="write-hint">Enter veya → ile onayla</p>
      )}
    </div>
  );
}

// ── Main SentencesPage ────────────────────────────────────────
export default function SentencesPage({ langConfig, onStudy }) {
  const [sentenceCategories, setSentenceCategories] = useState(langConfig?.sentenceCategories ?? []);
  const [sentencesLoading, setSentencesLoading] = useState((langConfig?.sentenceCategories ?? []).length === 0);
  const [phase, setPhase] = useState('setup'); // setup | playing | done

  useEffect(() => {
    if (!langConfig) return;
    if (sentenceCategories.length > 0) return;
    let active = true;
    loadSentenceCategories(langConfig.code).then(cats => {
      if (!active) return;
      setSentenceCategories(cats);
      setSentencesLoading(false);
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig?.code]);
  const [mode, setMode]   = useState(() => { try { return JSON.parse(localStorage.getItem('verbyte_practice_prefs'))?.mode  ?? 'fill' } catch { return 'fill' } });
  const [count, setCount] = useState(() => { try { return JSON.parse(localStorage.getItem('verbyte_practice_prefs'))?.count ?? 10   } catch { return 10   } });
  const [showSettings, setShowSettings] = useState(false);
  const [doneCorrect, setDoneCorrect] = useState(0);
  const [doneWrong, setDoneWrong] = useState(0);

  if (!langConfig) return null;
  const { wordKey } = langConfig;

  const COUNTS = [10, 20, null];

  function handleDone(c, w) {
    setDoneCorrect(c);
    setDoneWrong(w);
    setPhase('done');
  }

  function replay() {
    setPhase('playing');
  }

  if (sentencesLoading) {
    return (
      <div className="page quiz-setup" style={{ alignItems: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cümleler yükleniyor…</p>
      </div>
    );
  }

  if (phase === 'setup') {
    const modeLabels = { fill: 'Boşluk Doldur', sort: 'Kelime Sırala', write: 'Yaz' };
    function startPractice() {
      localStorage.setItem('verbyte_practice_prefs', JSON.stringify({ mode, count }));
      setPhase('playing');
    }
    return (
      <div className="page quiz-setup">
        <h2 className="quiz-setup-title">Pratik</h2>
        <p className="quiz-setup-sub">Cümle alıştırmaları</p>

        <button className="quiz-quick-start" onClick={startPractice}>
          <span className="qqs-label">{modeLabels[mode]} · {count ?? '∞'} soru</span>
          <span className="qqs-cta">Başla →</span>
        </button>

        <button className="quiz-settings-toggle" onClick={() => setShowSettings(v => !v)}>
          {showSettings ? '▲ Gizle' : '⚙ Ayarları değiştir'}
        </button>

        {showSettings && (
          <div className="quiz-settings-panel">
            <div className="quiz-section-label">Mod</div>
            <div className="quiz-mode-row" style={{ flexWrap: 'wrap' }}>
              <button className={`quiz-mode-btn${mode === 'fill' ? ' active' : ''}`} onClick={() => setMode('fill')}>
                <span className="qmode-icon">🔤</span>
                <span className="qmode-name">Boşluk Doldur</span>
                <span className="qmode-desc">Eksik kelimeyi bul</span>
              </button>
              <button className={`quiz-mode-btn${mode === 'sort' ? ' active' : ''}`} onClick={() => setMode('sort')}>
                <span className="qmode-icon">🔀</span>
                <span className="qmode-name">Kelime Sırala</span>
                <span className="qmode-desc">Cümleyi oluştur</span>
              </button>
              <button className={`quiz-mode-btn${mode === 'write' ? ' active' : ''}`} onClick={() => setMode('write')}>
                <span className="qmode-icon">✏️</span>
                <span className="qmode-name">Yaz</span>
                <span className="qmode-desc">Cümleyi kendin yaz</span>
              </button>
            </div>
            <div className="quiz-section-label">Soru Sayısı</div>
            <div className="quiz-count-row">
              {COUNTS.map((c) => (
                <button key={c ?? '∞'} className={`quiz-count-btn${count === c ? ' active' : ''}`} onClick={() => setCount(c)}>
                  {c ?? '∞'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <ScoreScreen
        correct={doneCorrect}
        wrong={doneWrong}
        onReplay={replay}
        onBack={() => setPhase('setup')}
      />
    );
  }

  // playing
  if (mode === 'fill') {
    return <FillMode key={mode + count} sentences={sentenceCategories} wordKey={wordKey} onDone={handleDone} count={count} onStudy={onStudy} />;
  }
  if (mode === 'write') {
    return <WriteMode key={mode + count} sentences={sentenceCategories} wordKey={wordKey} onDone={handleDone} count={count} onStudy={onStudy} />;
  }
  return <SortMode key={mode + count} sentences={sentenceCategories} wordKey={wordKey} onDone={handleDone} count={count} onStudy={onStudy} />;
}
