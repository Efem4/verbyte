import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './KesfPage.css';

const SWIPE_THRESHOLD = 80;
const AXIS_LOCK = 10;
const AXIS_DOM = 1.15;
const BATCH = 200;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Ortak swipe pointer logic ──────────────────────────────────
function useSwipe({ onTap }) {
  const startRef = useRef(null);
  const axisRef  = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function triggerSwipe(dir, setDrag, onDone) {
    setDrag({ x: dir === 'right' ? 500 : -500, dragging: false });
    timerRef.current = setTimeout(() => {
      setDrag({ x: 0, dragging: false });
      onDone(dir);
    }, 280);
  }

  return {
    onPointerDown(e) {
      startRef.current = { x: e.clientX, y: e.clientY };
      axisRef.current = null;
    },
    onPointerMove(e, setDrag) {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (!axisRef.current) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        if (Math.abs(dx) > Math.abs(dy) * AXIS_DOM) {
          axisRef.current = 'x';
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (Math.abs(dy) > Math.abs(dx) * AXIS_DOM) {
          axisRef.current = 'y';
          setDrag({ x: 0, dragging: false });
          return;
        } else return;
      }
      if (axisRef.current !== 'x') return;
      if (e.cancelable) e.preventDefault();
      setDrag({ x: dx, dragging: true });
    },
    onPointerUp(e, setDrag, onDone) {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = Math.abs(e.clientY - startRef.current.y);
      const wasX = axisRef.current === 'x';
      startRef.current = null;
      axisRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      if (Math.abs(dx) < 10 && dy < 10) {
        setDrag({ x: 0, dragging: false });
        onTap?.();
        return;
      }
      if (!wasX) { setDrag({ x: 0, dragging: false }); return; }
      if (Math.abs(dx) >= SWIPE_THRESHOLD) triggerSwipe(dx > 0 ? 'right' : 'left', setDrag, onDone);
      else setDrag({ x: 0, dragging: false });
    },
    onPointerCancel(e, setDrag) {
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      startRef.current = null;
      axisRef.current = null;
      setDrag({ x: 0, dragging: false });
    },
  };
}

// ── Kelime keşfi — 200'lük batch, auto-cycle ───────────────────
function KartKesfi({ langConfig }) {
  const { vocabulary, wordKey, languageLabel } = langConfig;

  const allWords = useMemo(() => shuffle(Object.values(vocabulary).flat()), [vocabulary]);
  const [batch, setBatch]     = useState(() => allWords.slice(0, BATCH));
  const [batchOff, setBatchOff] = useState(0);
  const [index, setIndex]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag]       = useState({ x: 0, dragging: false });

  const word = batch[index] ?? null;

  function next() {
    const ni = index + 1;
    if (ni >= batch.length) {
      const nextOff = batchOff + BATCH;
      const wrapped = nextOff >= allWords.length;
      const pool    = wrapped ? shuffle([...allWords]) : allWords;
      const off     = wrapped ? 0 : nextOff;
      setBatch(pool.slice(off, off + BATCH));
      setBatchOff(off);
      setIndex(0);
    } else {
      setIndex(ni);
    }
    setFlipped(false);
  }

  const sw = useSwipe({ onTap: () => setFlipped(f => !f) });

  const cardStyle = {
    transform: `translateX(${drag.x}px) rotate(${drag.x / 20}deg)`,
    transition: drag.dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
    cursor: drag.dragging ? 'grabbing' : 'grab',
  };

  if (!word) return (
    <div className="kesf-stage">
      <p style={{ color: 'var(--text-muted)' }}>Kelime bulunamadı.</p>
    </div>
  );

  return (
    <div className="kesf-stage">
      <div className="kesf-counter">{index + 1} / {batch.length}</div>

      <div
        className={`kesf-card${flipped ? ' flipped' : ''}`}
        style={cardStyle}
        onTouchStart={e => e.stopPropagation()}
        onPointerDown={sw.onPointerDown}
        onPointerMove={e => sw.onPointerMove(e, setDrag)}
        onPointerUp={e => sw.onPointerUp(e, setDrag, () => next())}
        onPointerCancel={e => sw.onPointerCancel(e, setDrag)}
      >
        <div className="kesf-card-inner">

          {/* — Ön yüz — */}
          <div className="kesf-card-front">
            <div className="card-front-top">
              <span className="card-lang-chip">{languageLabel}</span>
            </div>
            <div className="card-front-body">
              <span className="card-word">{word[wordKey] ?? word.fr ?? word.en}</span>
            </div>
            <div className="card-front-bottom">
              <span className="card-tap">Dokun: çevir · Kaydır: sonraki</span>
            </div>
          </div>

          {/* — Arka yüz — */}
          <div className="kesf-card-back">
            <div className="card-front-top">
              <span className="card-back-lang-chip">Türkçe</span>
            </div>
            <div className="card-front-body">
              <span className="card-translation">{word.tr}</span>
            </div>
            <div className="card-front-bottom">
              {word.example
                ? <span className="card-example-hint">{word.example}</span>
                : <div />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Cümle keşfi — kesf.json'dan yükler, 200'lük batch ────────
function CumleKesfi({ lang }) {
  const [allCards, setAllCards] = useState([]);
  const [batch, setBatch]       = useState([]);
  const [index, setIndex]       = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [drag, setDrag]         = useState({ x: 0, dragging: false });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${import.meta.env.BASE_URL}data/${lang}/kesf.json`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(data => {
        const shuffled = shuffle(data);
        setAllCards(shuffled);
        setBatch(shuffled.slice(0, BATCH));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [lang]);

  function goNext() {
    const ni = index + 1;
    if (ni >= batch.length) {
      // Yeni batch — tüm listeyi yeniden karıştır
      const newShuffled = shuffle([...allCards]);
      setAllCards(newShuffled);
      setBatch(newShuffled.slice(0, BATCH));
      setIndex(0);
    } else {
      setIndex(ni);
    }
    setFlipped(false);
  }

  function goPrev() {
    if (index > 0) { setIndex(i => i - 1); setFlipped(false); }
  }

  const sw = useSwipe({ onTap: () => setFlipped(f => !f) });
  const card = batch[index];

  const cardStyle = {
    transform: `translateX(${drag.x}px) rotate(${drag.x / 20}deg)`,
    transition: drag.dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
    cursor: drag.dragging ? 'grabbing' : 'grab',
  };

  if (loading) return (
    <div className="kesf-done">
      <div className="kesf-done-emoji">📖</div>
      <p className="kesf-done-text">Cümleler yükleniyor…</p>
    </div>
  );

  if (error || !card) return (
    <div className="kesf-done">
      <div className="kesf-done-emoji">📭</div>
      <p className="kesf-done-text">Cümle verisi bulunamadı.</p>
    </div>
  );

  return (
    <div className="kesf-stage">
      <div className="kesf-counter">{index + 1} / {batch.length}</div>

      <div
        className={`kesf-card${flipped ? ' flipped' : ''}`}
        style={cardStyle}
        onTouchStart={e => e.stopPropagation()}
        onPointerDown={sw.onPointerDown}
        onPointerMove={e => sw.onPointerMove(e, setDrag)}
        onPointerUp={e => sw.onPointerUp(e, setDrag, dir => dir === 'right' ? goNext() : goPrev())}
        onPointerCancel={e => sw.onPointerCancel(e, setDrag)}
      >
        <div className="kesf-card-inner">

          {/* — Ön yüz — */}
          <div className="kesf-card-front">
            <div className="card-front-top">
              <span className="card-lang-chip">Cümle</span>
            </div>
            <div className="card-front-body">
              <span className="card-word" style={{ fontSize: 20, lineHeight: 1.55 }}>
                {card.text}
              </span>
            </div>
            <div className="card-front-bottom">
              <span className="card-tap">Dokun: çevir · Kaydır: ileri/geri</span>
            </div>
          </div>

          {/* — Arka yüz — */}
          <div className="kesf-card-back">
            <div className="card-front-top">
              <span className="card-back-lang-chip">Türkçe</span>
            </div>
            <div className="card-front-body">
              <span className="card-translation" style={{ fontSize: 20, lineHeight: 1.55 }}>
                {card.tr}
              </span>
            </div>
            <div className="card-front-bottom">
              <span className="card-example-hint">{card.word} → {card.wordTr}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Ana sayfa ──────────────────────────────────────────────────
export default function KesfPage({ langConfig, hasBar }) {
  if (!langConfig) return null;
  const [mode, setMode] = useState('kart');
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('verbyte_kesf_seen')
  );

  const dismissWelcome = () => {
    localStorage.setItem('verbyte_kesf_seen', '1');
    setShowWelcome(false);
  };

  return (
    <div className={`kesf-page${hasBar ? ' kesf-page--bar' : ''}`}>
      {showWelcome && (
        <div className="kesf-welcome">
          <span>👋 Kelimeleri swipe yaparak keşfet, dokunarak çevir</span>
          <button className="kesf-welcome-close" onClick={dismissWelcome}>✕</button>
        </div>
      )}

      <div className="kesf-tabs">
        <button
          className={`kesf-tab${mode === 'kart' ? ' active' : ''}`}
          onClick={() => setMode('kart')}
        >🃏 Kelimeler</button>
        <button
          className={`kesf-tab${mode === 'cumle' ? ' active' : ''}`}
          onClick={() => setMode('cumle')}
        >📖 Cümleler</button>
      </div>

      {mode === 'kart' && <KartKesfi key="kart" langConfig={langConfig} />}
      {mode === 'cumle' && <CumleKesfi key={`cumle-${langConfig.code}`} lang={langConfig.code} />}
    </div>
  );
}
