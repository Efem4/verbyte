import { useEffect, useRef, useState } from 'react';
import { getSentenceAudioUrl } from '../config/audioConfig';
import './Flashcard.css';

const SWIPE_THRESHOLD = 80;
const AXIS_LOCK_DISTANCE = 10;
const AXIS_DOMINANCE = 1.15;

const COMBO_TIERS = [
  { min: 20, gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)', glow: 'rgba(245,158,11,0.65)', label: '✨', pulse: true },
  { min: 10, gradient: 'linear-gradient(135deg, #A855F7, #6366F1)', glow: 'rgba(168,85,247,0.65)', label: '🔮', pulse: true },
  { min: 5,  gradient: 'linear-gradient(135deg, #F97316, #EF4444)', glow: 'rgba(249,115,22,0.55)', label: '🔥', pulse: false },
  { min: 2,  gradient: 'linear-gradient(135deg, #F97316, #EF4444)', glow: 'rgba(249,115,22,0.3)',  label: '🔥', pulse: false },
];

const PARTICLE_COLORS = ['#34D399', '#6EE7B7', '#FCD34D', '#FBBF24', '#67E8F9', '#A7F3D0', '#86EFAC', '#FDE68A'];

function getComboBadge(count) {
  return COMBO_TIERS.find((t) => count >= t.min) ?? COMBO_TIERS[COMBO_TIERS.length - 1];
}

let _sentAudio = null;
function playSentenceAudio(lang, sentenceId) {
  if (_sentAudio && !_sentAudio.ended && !_sentAudio.paused) return;
  _sentAudio = new Audio(getSentenceAudioUrl(lang, sentenceId));
  _sentAudio.play().catch(() => {});
  _sentAudio.onended = () => { _sentAudio = null; };
}

// Cümleyi parçala: _____ öncesi ve sonrası + cevap kelimesi vurgulu göster
function SentenceText({ text, answer, wordKey }) {
  const fullText = text?.replace('_____', answer ?? '') ?? '';
  if (!answer || !fullText.includes(answer)) {
    return <span className="sent-text">{fullText}</span>;
  }
  const idx = fullText.indexOf(answer);
  const before = fullText.slice(0, idx);
  const after  = fullText.slice(idx + answer.length);
  return (
    <span className="sent-text">
      {before}
      <mark className="sent-highlight">{answer}</mark>
      {after}
    </span>
  );
}

export default function SentenceFlashcard({
  sentence,
  wordKey,
  languageLabel,
  onKnow,
  onSkip,
  total,
  combo,
  levelColor,
  isNew,
}) {
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const [particles, setParticles] = useState([]);
  const startRef = useRef(null);
  const axisRef = useRef(null);
  const swipeRef = useRef(null);
  const shakeWrapperRef = useRef(null);
  const shakeTimeoutRef = useRef(null);
  const particleTimeoutRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(swipeRef.current);
    clearTimeout(shakeTimeoutRef.current);
    clearTimeout(particleTimeoutRef.current);
  }, []);

  const sentText = sentence[wordKey] ?? sentence.fr ?? sentence.en ?? '';

  function triggerParticles() {
    const count = 12;
    const newParticles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 360 + (Math.random() - 0.5) * 30;
      const distance = 65 + Math.random() * 70;
      const rad = (angle * Math.PI) / 180;
      const tx = Math.cos(rad) * distance;
      const ty = Math.sin(rad) * distance;
      const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      const size = 5 + Math.random() * 9;
      return { id: Date.now() + i, tx, ty, color, size };
    });
    setParticles(newParticles);
    clearTimeout(particleTimeoutRef.current);
    particleTimeoutRef.current = setTimeout(() => setParticles([]), 500);
  }

  function triggerShake() {
    const el = shakeWrapperRef.current;
    if (!el) return;
    el.classList.remove('shaking');
    void el.offsetWidth;
    el.classList.add('shaking');
    clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => el?.classList.remove('shaking'), 500);
  }

  function onPointerDown(event) {
    if (event.target.closest('button')) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    axisRef.current = null;
    setDrag({ x: 0, dragging: false });
  }

  function onPointerMove(event) {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (!axisRef.current) {
      if (absX < AXIS_LOCK_DISTANCE && absY < AXIS_LOCK_DISTANCE) return;
      if (absX > absY * AXIS_DOMINANCE) {
        axisRef.current = 'x';
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (absY > absX * AXIS_DOMINANCE) {
        axisRef.current = 'y';
        setDrag({ x: 0, dragging: false });
        return;
      } else return;
    }
    if (axisRef.current !== 'x') return;
    if (event.cancelable) event.preventDefault();
    setDrag({ x: dx, dragging: true });
  }

  function onPointerUp(event) {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = Math.abs(event.clientY - startRef.current.y);
    const wasDraggingX = axisRef.current === 'x';
    startRef.current = null;
    axisRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(dx) < 10 && dy < 10) {
      setDrag({ x: 0, dragging: false });
      setFlipped((v) => !v);
      return;
    }
    if (!wasDraggingX) { setDrag({ x: 0, dragging: false }); return; }
    if (dx > SWIPE_THRESHOLD) triggerSwipe('right');
    else if (dx < -SWIPE_THRESHOLD) triggerSwipe('left');
    else setDrag({ x: 0, dragging: false });
  }

  function triggerSwipe(direction) {
    if (direction === 'right') triggerParticles();
    else triggerShake();
    setDrag({ x: direction === 'right' ? 500 : -500, dragging: false });
    swipeRef.current = setTimeout(() => {
      setFlipped(false);
      setDrag({ x: 0, dragging: false });
      if (direction === 'right') onKnow();
      else onSkip();
    }, 320);
  }

  function handleKnowClick() { triggerParticles(); onKnow(); }
  function handleSkipClick() { triggerShake(); onSkip(); }

  const rotate = drag.x / 18;
  const overlayOpacity = Math.min(Math.abs(drag.x) / SWIPE_THRESHOLD, 1);
  const isRight = drag.x > 0;
  const comboTier = combo >= 2 ? getComboBadge(combo) : null;

  const cardStyle = {
    transform: `translateX(${drag.x}px) rotate(${rotate}deg)`,
    transition: drag.dragging ? 'none' : 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    cursor: drag.dragging ? 'grabbing' : 'grab',
    boxShadow: comboTier ? `0 0 48px ${comboTier.glow}, 0 12px 48px rgba(0,0,0,0.5)` : undefined,
  };

  return (
    <div className="flashcard-wrapper">
      <div className="card-top-row">
        <div className="card-counter">{total} cümle kaldı</div>
        {comboTier && (
          <div
            className={`combo-badge${comboTier.pulse ? ' combo-badge--pulse' : ''}`}
            key={combo}
            style={{ background: comboTier.gradient, boxShadow: `0 0 16px ${comboTier.glow}` }}
          >
            {comboTier.label} x{combo}
          </div>
        )}
      </div>

      <div className="swipe-hints">
        <span className={`swipe-hint swipe-hint--left${drag.x < -20 ? ' visible' : ''}`}>❌ Bilmiyorum</span>
        <span className={`swipe-hint swipe-hint--right${drag.x > 20 ? ' visible' : ''}`}>✅ Biliyorum</span>
      </div>

      <div className="flashcard-stage">
        {comboTier && (
          <>
            <div className="combo-ambient combo-ambient--tl" style={{ background: comboTier.glow }} />
            <div className="combo-ambient combo-ambient--br" style={{ background: comboTier.glow }} />
          </>
        )}

        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{ '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, background: p.color, width: `${p.size}px`, height: `${p.size}px` }}
          />
        ))}

        <div ref={shakeWrapperRef} className="card-shake-wrapper">
          <div
            className={`flashcard${flipped ? ' flipped' : ''}`}
            style={cardStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
              startRef.current = null; axisRef.current = null;
              setDrag({ x: 0, dragging: false });
            }}
          >
            {overlayOpacity > 0 && (
              <div className="swipe-overlay" style={{ opacity: overlayOpacity * 0.55, background: isRight ? '#10B981' : '#EF4444' }} />
            )}

            <div className="card-inner">
              {/* ── Front ── */}
              <div className="card-front">
                {levelColor && <div className="card-level-bar" style={{ background: levelColor }} />}
                <div className="card-front-top">
                  <span className="card-lang-chip">{languageLabel}</span>
                  {isNew && <span className="card-new-badge">🆕 Yeni</span>}
                </div>
                <div className="card-front-body sent-front-body">
                  <SentenceText text={sentText} answer={sentence.answer} wordKey={wordKey} />
                  <button
                    className="btn-audio"
                    onClick={e => { e.stopPropagation(); playSentenceAudio(wordKey, sentence.id); }}
                    title="Cümleyi dinle"
                  >🔊</button>
                </div>
                <div className="card-front-bottom">
                  <div className="card-tap">Dokun: çevir · Kaydır: geç</div>
                </div>
              </div>

              {/* ── Back ── */}
              <div className="card-back">
                {levelColor && <div className="card-level-bar" style={{ background: levelColor }} />}
                <div className="card-back-content">
                  <span className="card-back-lang">Türkçe</span>
                  <div className="card-translation" style={{ fontSize: '1.1rem' }}>
                    {sentence.tip || sentence.tr || sentence.answer}
                  </div>
                  {sentence.answer && (
                    <div className="card-example-block">
                      <span className="card-example-label">Kelime</span>
                      <span className="card-example-text">{sentence.answer}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-actions">
        <button className="btn-skip" onClick={handleSkipClick}>✗ Bilmedim</button>
        <button className="btn-know" onClick={handleKnowClick}>✓ Bildim</button>
      </div>
    </div>
  );
}
