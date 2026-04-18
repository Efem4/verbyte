import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { getAudioUrl } from '../config/audioConfig';
import './Flashcard.css';

const COMBO_TIERS = [
  { min: 20, gradient: 'linear-gradient(135deg, #C4B0CC, #9076A8)', glow: 'rgba(196,176,204,0.70)', ambient: 'rgba(196,176,204,0.10)', label: '◆', pulse: true  },
  { min: 10, gradient: 'linear-gradient(135deg, #AA93BA, #765A96)', glow: 'rgba(170,147,186,0.60)', ambient: 'rgba(170,147,186,0.09)', label: '●', pulse: true  },
  { min: 5,  gradient: 'linear-gradient(135deg, #9076A8, #5C3D84)', glow: 'rgba(144,118,168,0.50)', ambient: 'rgba(144,118,168,0.07)', label: '▲', pulse: false },
  { min: 2,  gradient: 'linear-gradient(135deg, #7A6090, #5C3D84)', glow: 'rgba(122, 96,144,0.30)', ambient: null,                    label: '▸', pulse: false },
];

const PARTICLE_COLORS = ['#C4B0CC', '#D4C4DC', '#AA93BA', '#9076A8', '#E8DFF0', '#B89CC8', '#765A96', '#F0EAF8'];

function getComboBadge(count) {
  return COMBO_TIERS.find((t) => count >= t.min) ?? COMBO_TIERS[COMBO_TIERS.length - 1];
}

let _currentAudio = null;

function playAudio(lang, wordId) {
  if (_currentAudio && !_currentAudio.ended && !_currentAudio.paused) return;
  const url = getAudioUrl(lang, wordId);
  _currentAudio = new Audio(url);
  _currentAudio.play().catch(() => {});
  _currentAudio.onended = () => { _currentAudio = null; };
}

export default function Flashcard({
  word,
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
  const [particles, setParticles] = useState([]);
  const [showHint, setShowHint] = useState(
    () => !localStorage.getItem('verbyte_hint_dismissed')
  );
  const shakeWrapperRef = useRef(null);
  const shakeTimeoutRef = useRef(null);
  const particleTimeoutRef = useRef(null);
  const cardStartRef = useRef(Date.now());
  const wasFlippedRef = useRef(false);

  // Framer Motion values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const knowOpacity = useTransform(x, [20, 80], [0, 1]);
  const skipOpacity = useTransform(x, [-80, -20], [1, 0]);

  const targetWord = word[wordKey] ?? word.fr ?? word.en ?? '';
  const comboTier = combo >= 2 ? getComboBadge(combo) : null;

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

  function handleKnowClick() {
    triggerParticles();
    const timeMs = Date.now() - cardStartRef.current;
    onKnow(timeMs, wasFlippedRef.current);
  }

  function handleSkipClick() {
    triggerShake();
    onSkip();
  }

  return (
    <div className="flashcard-wrapper">
      <div className="card-top-row">
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
        <span className="swipe-hint swipe-hint--left">❌ Bilmiyorum</span>
        <span className="swipe-hint swipe-hint--right">✅ Biliyorum</span>
      </div>

      <div className="flashcard-stage">
        {comboTier?.ambient && (
          <>
            <div className="combo-ambient combo-ambient--tl" style={{ background: comboTier.glow }} />
            <div className="combo-ambient combo-ambient--br" style={{ background: comboTier.glow }} />
            <div className="combo-ambient combo-ambient--tc" style={{ background: comboTier.glow }} />
          </>
        )}

        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              background: p.color,
              width: `${p.size}px`,
              height: `${p.size}px`,
            }}
          />
        ))}

        <div ref={shakeWrapperRef} className="card-shake-wrapper">
          <AnimatePresence mode="wait">
            <motion.div
              key={word.id ?? word[wordKey]}
              className={`flashcard${flipped ? ' flipped' : ''}`}
              style={{
                x,
                rotate,
                boxShadow: comboTier
                  ? `0 0 48px ${comboTier.glow}, 0 12px 48px rgba(0,0,0,0.5)`
                  : undefined,
              }}
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, info) => {
                if (info.offset.x > 80) {
                  triggerParticles();
                  const timeMs = Date.now() - cardStartRef.current;
                  onKnow(timeMs, wasFlippedRef.current);
                } else if (info.offset.x < -80) {
                  triggerShake();
                  onSkip();
                }
                x.set(0);
              }}
              onClick={() => {
                if (Math.abs(x.get()) < 5) {
                  if (!flipped) wasFlippedRef.current = true;
                  setFlipped(f => !f);
                  if (showHint) {
                    setShowHint(false);
                    localStorage.setItem('verbyte_hint_dismissed', '1');
                  }
                }
              }}
            >
              {/* Swipe hint overlays */}
              <motion.div
                className="swipe-hint-overlay swipe-hint-overlay--know"
                style={{ opacity: knowOpacity }}
              >
                ✓
              </motion.div>
              <motion.div
                className="swipe-hint-overlay swipe-hint-overlay--skip"
                style={{ opacity: skipOpacity }}
              >
                ✗
              </motion.div>

              <div className="card-inner">
                {/* Front */}
                <div className="card-front">
                  {levelColor && <div className="card-level-bar" style={{ background: levelColor }} />}
                  <div className="card-front-top">
                    <span className="card-lang-chip">{languageLabel}</span>
                    {isNew && <span className="card-new-badge">🆕 Yeni</span>}
                  </div>
                  <div className="card-front-body">
                    <div className="card-word">
                      {targetWord}
                      <span
                        className="audio-icon"
                        onClick={e => { e.stopPropagation(); playAudio(wordKey, word.id); }}
                        title="Sesi dinle"
                        role="button"
                        aria-label="Sesi dinle"
                      >🔊</span>
                    </div>
                  </div>
                  <div className="card-front-bottom">
                    <div className="card-tap">Dokun: çevir · Kaydır: geç</div>
                  </div>
                  {showHint && (
                    <div className="card-flip-hint">Dokunun → çevirmek için</div>
                  )}
                </div>

                {/* Back — mirrors front layout exactly */}
                <div className="card-back">
                  {levelColor && <div className="card-level-bar" style={{ background: levelColor }} />}
                  <div className="card-front-top">
                    <span className="card-back-lang-chip">Türkçe</span>
                  </div>
                  <div className="card-front-body">
                    <div className="card-translation">{word.tr}</div>
                  </div>
                  <div className="card-front-bottom">
                    {word.example
                      ? <div className="card-example-hint">{word.example}</div>
                      : <div />}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="card-actions">
        <motion.button
          className="btn-skip"
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.04 }}
          onClick={handleSkipClick}
        >
          ✗ Bilmedim
        </motion.button>
        <motion.button
          className="btn-know"
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.04 }}
          onClick={handleKnowClick}
        >
          ✓ Bildim
        </motion.button>
      </div>
    </div>
  );
}
