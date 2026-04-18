import { useEffect, useRef, useState } from 'react';
import { getAudioUrl } from '../config/audioConfig';

let _quizAudio = null;
function playWordAudio(wordId, langCode) {
  if (_quizAudio && !_quizAudio.ended && !_quizAudio.paused) return;
  _quizAudio = new Audio(getAudioUrl(langCode, wordId));
  _quizAudio.play().catch(() => {});
}

const QUESTION_COUNTS = [10, 20, null];
const TIMER_SEC = 10;
const REVEAL_DELAY = 1400;

const QUIZ_PREFS_KEY = 'verbyte_quiz_prefs';

function loadQuizPrefs() {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_PREFS_KEY)) || {};
  } catch { return {}; }
}

const CHOICE_COLORS = [
  { base: '#E53E3E', light: 'rgba(229,62,62,0.18)',  border: 'rgba(229,62,62,0.5)'  },
  { base: '#3182CE', light: 'rgba(49,130,206,0.18)',  border: 'rgba(49,130,206,0.5)'  },
  { base: '#D69E2E', light: 'rgba(214,158,46,0.18)',  border: 'rgba(214,158,46,0.5)'  },
  { base: '#38A169', light: 'rgba(56,161,105,0.18)',  border: 'rgba(56,161,105,0.5)'  },
];
const SHAPES = ['▲', '◆', '●', '★'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(vocabulary, wordKey, count, direction) {
  const allWords = Object.entries(vocabulary).flatMap(([catId, words]) =>
    words.map((w) => ({ ...w, catId }))
  );
  const shuffled = shuffle(allWords);
  const pool = shuffled.slice(0, count || 100);

  return pool.map((word) => {
    if (direction === 'word-tr') {
      // Show target language word → pick Turkish meaning
      const correct = word.tr;
      const wrongPool = shuffle(allWords.filter(w => w.tr !== correct));
      const wrongs = [];
      const seen = new Set([correct]);
      for (const w of wrongPool) {
        if (wrongs.length === 3) break;
        if (!seen.has(w.tr)) { seen.add(w.tr); wrongs.push(w.tr); }
      }
      return {
        question: word[wordKey],
        answer: correct,
        choices: shuffle([correct, ...wrongs]),
        questionIsWord: true,
        wordId: word.id,
      };
    } else {
      // Show Turkish → pick target language word (default)
      const correct = word[wordKey];
      const sameCat = allWords.filter(w => w.catId === word.catId && w[wordKey] !== correct);
      const other   = allWords.filter(w => w.catId !== word.catId);
      const wrongPool = shuffle([...sameCat, ...other]);
      const wrongs = [];
      const seen = new Set([correct]);
      for (const w of wrongPool) {
        if (wrongs.length === 3) break;
        if (!seen.has(w[wordKey])) { seen.add(w[wordKey]); wrongs.push(w[wordKey]); }
      }
      return {
        question: word.tr,
        answer: correct,
        choices: shuffle([correct, ...wrongs]),
        questionIsWord: false,
        wordId: word.id,
      };
    }
  });
}

export default function QuizPage({ langConfig, onStudy }) {
  if (!langConfig) return null;
  const { vocabulary, wordKey, languageLabel } = langConfig;

  // Vocabulary henüz boş mu?
  const totalWords = Object.values(vocabulary || {}).reduce((s, arr) => s + arr.length, 0)
  if (totalWords === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="es-icon">📖</div>
          <h3 className="es-title">Kelime yok henüz</h3>
          <p className="es-desc">Önce Kartlar bölümünden kelime çalış — quiz için en az 4 kelime gerekli.</p>
        </div>
      </div>
    )
  }
  const langLabel = wordKey.toUpperCase(); // 'FR' | 'EN' | 'DE'

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState(() => loadQuizPrefs().mode ?? 'classic');
  const [direction, setDirection] = useState(() => loadQuizPrefs().direction ?? 'tr-word');
  const [questionCount, setQuestionCount] = useState(() => loadQuizPrefs().questionCount ?? 10);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SEC);
  const [totalTime, setTotalTime] = useState(0);
  const [floatingScores, setFloatingScores] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef(null);
  const revealRef = useRef(null);
  const handleAnswerRef = useRef(null);

  function startQuiz() {
    localStorage.setItem(QUIZ_PREFS_KEY, JSON.stringify({ mode, direction, questionCount }));
    const qs = buildQuestions(vocabulary, wordKey, questionCount, direction);
    setQuestions(qs);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrect(0);
    setWrong(0);
    setTimeLeft(TIMER_SEC);
    setTotalTime(0);
    setFloatingScores([]);
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing' || mode !== 'classic' || selected !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, current, selected, mode]);

  useEffect(() => {
    if (phase === 'playing' && mode === 'classic' && timeLeft === 0 && selected === null) {
      handleAnswerRef.current?.(null);
    }
  }, [timeLeft, phase, mode, selected]);

  function handleAnswer(choice) {
    if (selected !== null) return;
    clearInterval(timerRef.current);

    const q = questions[current];
    const isCorrect = choice === q.answer;

    setSelected(choice ?? '__timeout__');

    let newCombo = combo;
    let newScore = score;
    let gained = 0;

    if (isCorrect) {
      onStudy?.();
      newCombo = combo + 1;
      const multiplier = Math.min(3, 1 + (newCombo - 1) * 0.5);
      const speedBonus = mode === 'classic' ? Math.round((timeLeft / TIMER_SEC) * 100) : 0;
      gained = Math.round((100 + speedBonus) * multiplier);
      newScore = score + gained;
      setCorrect((c) => c + 1);

      // Floating score popup
      const floatText = newCombo >= 5 ? `⚡ x${newCombo}  +${gained}` : `+${gained}`;
      const floatId = Date.now();
      const floatX = 25 + Math.random() * 50;
      setFloatingScores(prev => [...prev, { id: floatId, text: floatText, x: floatX }]);
      setTimeout(() => setFloatingScores(prev => prev.filter(f => f.id !== floatId)), 950);
    } else {
      newCombo = 0;
      setWrong((w) => w + 1);
    }

    setCombo(newCombo);
    setMaxCombo((m) => Math.max(m, newCombo));
    setScore(newScore);
    if (mode === 'classic') setTotalTime((t) => t + (TIMER_SEC - timeLeft));

    // TR→Kelime modunda: cevap verince doğru kelimeyi seslendir
    if (!q.questionIsWord && q.wordId) {
      setTimeout(() => playWordAudio(q.wordId, wordKey), 200);
    }

    revealRef.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) {
        setPhase('done');
      } else {
        setCurrent(next);
        setSelected(null);
        setTimeLeft(TIMER_SEC);
      }
    }, REVEAL_DELAY);
  }

  useEffect(() => { handleAnswerRef.current = handleAnswer; });

  // Soru değişince otomatik ses çal
  useEffect(() => {
    if (phase !== 'playing' || questions.length === 0) return;
    const q = questions[current];
    if (!q?.wordId) return;
    // word-tr: yabancı kelime sorulunca hemen çal
    // tr-word: cevap verildikten sonra doğru kelimeyi çal (reveal sırasında)
    if (q.questionIsWord) {
      // küçük gecikme — UI geçiş animasyonu bitsin
      const t = setTimeout(() => playWordAudio(q.wordId, wordKey), 300);
      return () => clearTimeout(t);
    }
  }, [current, phase, questions, wordKey]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(revealRef.current);
  }, []);

  // ── Setup ──────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="page quiz-setup">
        <div className="setup-core">
          <h2 className="quiz-setup-title">Quiz</h2>
          <p className="quiz-setup-sub">{languageLabel} kelimelerini test et</p>

          <button className="quiz-quick-start" onClick={startQuiz}>
            <span className="qqs-label">
              {mode === 'classic' ? 'Classic' : 'Zen'} · {questionCount ?? '∞'} soru · {direction === 'tr-word' ? 'TR → ' + langLabel : langLabel + ' → TR'}
            </span>
            <span className="qqs-cta">Başla →</span>
          </button>

          <button className="quiz-settings-toggle" onClick={() => setShowSettings(v => !v)}>
            {showSettings ? '▲ Gizle' : '⚙ Ayarları değiştir'}
          </button>
        </div>

        {showSettings && (
          <div className="quiz-settings-panel">
            <div className="quiz-section-label">Mod</div>
            <div className="quiz-mode-row">
              <button
                className={`quiz-mode-btn${mode === 'classic' ? ' active' : ''}`}
                onClick={() => setMode('classic')}
              >
                <span className="qmode-icon">⏱</span>
                <span className="qmode-name">Classic</span>
                <span className="qmode-desc">10 sn, puan + hız bonusu</span>
              </button>
              <button
                className={`quiz-mode-btn${mode === 'zen' ? ' active' : ''}`}
                onClick={() => setMode('zen')}
              >
                <span className="qmode-icon">🧘</span>
                <span className="qmode-name">Zen</span>
                <span className="qmode-desc">Süresiz, sadece doğru/yanlış</span>
              </button>
            </div>

            <div className="quiz-section-label">Yön</div>
            <div className="quiz-mode-row">
              <button
                className={`quiz-mode-btn${direction === 'tr-word' ? ' active' : ''}`}
                onClick={() => setDirection('tr-word')}
              >
                <span className="qmode-name">TR → {langLabel}</span>
              </button>
              <button
                className={`quiz-mode-btn${direction === 'word-tr' ? ' active' : ''}`}
                onClick={() => setDirection('word-tr')}
              >
                <span className="qmode-name">{langLabel} → TR</span>
              </button>
            </div>

            <div className="quiz-section-label">Soru Sayısı</div>
            <div className="quiz-count-row">
              {QUESTION_COUNTS.map((c) => (
                <button
                  key={c ?? 'inf'}
                  className={`quiz-count-btn${questionCount === c ? ' active' : ''}`}
                  onClick={() => setQuestionCount(c)}
                >
                  {c ?? '∞'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="setup-spacer" />
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────
  if (phase === 'done') {
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgTime = mode === 'classic' && total > 0 ? (totalTime / total).toFixed(1) : null;
    const grade = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎯' : accuracy >= 50 ? '💪' : '📚';
    const gradeMsg = accuracy >= 90 ? 'Mükemmel!' : accuracy >= 70 ? 'Harika!' : accuracy >= 50 ? 'İyi iş!' : 'Devam et!';

    return (
      <div className="page quiz-done">
        <div className="quiz-done-emoji quiz-done-emoji--animated">{grade}</div>
        <h2 className="quiz-done-title">{gradeMsg}</h2>
        {mode === 'classic' && (
          <div className="quiz-final-score">{score.toLocaleString()} <span className="quiz-final-score-label">puan</span></div>
        )}
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
            <span className="qdone-val" style={{ color: accuracy >= 70 ? '#34D399' : '#FBBF24' }}>{accuracy}%</span>
            <span className="qdone-lbl">Doğruluk</span>
          </div>
          <div className="qdone-stat">
            <span className="qdone-val">{maxCombo}x</span>
            <span className="qdone-lbl">Max Combo</span>
          </div>
          {avgTime && (
            <div className="qdone-stat">
              <span className="qdone-val">{avgTime}s</span>
              <span className="qdone-lbl">Ort. Süre</span>
            </div>
          )}
        </div>
        <div className="quiz-done-actions">
          <button className="btn-primary" onClick={startQuiz}>Tekrar Oyna</button>
          <button className="btn-secondary" onClick={() => setPhase('setup')}>Ayarları Değiştir</button>
        </div>
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────
  const q = questions[current];
  const total = questions.length;
  const timerPct = (timeLeft / TIMER_SEC) * 100;
  const timerColor = timeLeft > 6 ? '#34D399' : timeLeft > 3 ? '#FBBF24' : '#F87171';

  const questionLabel = q.questionIsWord
    ? 'Türkçe karşılığı nedir?'
    : `${languageLabel} karşılığı nedir?`;

  return (
    <div className="quiz-play">
      {/* Floating scores */}
      {floatingScores.map(f => (
        <div key={f.id} className="floating-score" style={{ '--fx': `${f.x}%` }}>
          {f.text}
        </div>
      ))}

      {/* Top bar */}
      <div className="quiz-topbar">
        <div className="quiz-progress-wrap">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
          </div>
          <span className="quiz-qnum">{current + 1} / {questionCount === null ? '∞' : total}</span>
        </div>
        {mode === 'classic' && (
          <div className="quiz-score-chip">{score.toLocaleString()}</div>
        )}
        {questionCount === null && (
          <button className="quiz-end-btn" onClick={() => setPhase('done')}>Bitir</button>
        )}
      </div>

      {/* Timer */}
      {mode === 'classic' && (
        <div className="quiz-timer-wrap">
          <div className="quiz-timer-bar">
            <div
              className="quiz-timer-fill"
              style={{
                width: `${timerPct}%`,
                background: timerColor,
                transition: selected ? 'none' : 'width 1s linear, background 0.3s',
              }}
            />
          </div>
          <span className="quiz-timer-num" style={{ color: timerColor }}>{timeLeft}</span>
        </div>
      )}

      {/* Combo */}
      {combo >= 2 && (
        <div className="quiz-combo-badge" key={combo}>⚡ {combo}x Combo</div>
      )}

      {/* Question */}
      <div className={`quiz-question-card${q.questionIsWord ? ' quiz-question-card--word' : ''}`}>
        <span className="quiz-question-label">{questionLabel}</span>
        <span className="quiz-question-text">{q.question}</span>
      </div>

      {/* Choices */}
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
