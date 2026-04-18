import { useState } from 'react';
import { getMasteredCount } from '../utils/srs';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const LEVEL_MOTIVATIONS = {
  A1: [
    { min: 100, text: 'Temel kelimeler tamam! 🎉' },
    { min: 75,  text: 'Neredeyse bitirdin!' },
    { min: 50,  text: 'Yarı yoldasın, devam!' },
    { min: 25,  text: 'Güzel başlangıç!' },
    { min: 0,   text: 'Buradan başla 👋' },
  ],
  A2: [
    { min: 100, text: 'Günlük konuşma artık kolay! ✨' },
    { min: 75,  text: 'Az kaldı, son hamle!' },
    { min: 50,  text: 'İyi gidiyorsun!' },
    { min: 25,  text: 'Devam et!' },
    { min: 0,   text: 'A1\'i bitirince aç 🔒' },
  ],
  B1: [
    { min: 100, text: 'Orta seviye tamam! 💪' },
    { min: 75,  text: 'Çok yaklaştın!' },
    { min: 50,  text: 'Yarı yolun geçtin!' },
    { min: 25,  text: 'Isınıyorsun!' },
    { min: 0,   text: 'A2\'yi bitirince aç 🔒' },
  ],
  B2: [
    { min: 100, text: 'İleri seviye! Harika 🔥' },
    { min: 75,  text: 'Bitiyor!' },
    { min: 50,  text: 'Yarısını geçtin!' },
    { min: 25,  text: 'Devam et!' },
    { min: 0,   text: 'B1\'i bitirince aç 🔒' },
  ],
  C1: [
    { min: 100, text: 'Ustasın! 🏆' },
    { min: 75,  text: 'Finale yakın!' },
    { min: 50,  text: 'Zirveye tırmanıyorsun!' },
    { min: 25,  text: 'İleri gidiyorsun!' },
    { min: 0,   text: 'B2\'yi bitirince aç 🔒' },
  ],
};

const OVERALL_MEDALS = [
  { min: 100, label: '🏆 Usta' },
  { min: 75,  label: '🥇 İleri Seviye' },
  { min: 50,  label: '🥈 Orta Seviye' },
  { min: 25,  label: '🥉 Başlangıç' },
  { min: 0,   label: '🌱 Yeni Başlayan' },
];

function getMotivation(level, pct) {
  const tiers = LEVEL_MOTIVATIONS[level] ?? LEVEL_MOTIVATIONS.A1;
  return tiers.find(t => pct >= t.min)?.text ?? '';
}

function getKnownCount(catProgress) {
  if (!catProgress || Array.isArray(catProgress)) return 0;
  return Object.keys(catProgress).length;
}

function getLevelStats(level, categories, vocabulary, progress) {
  const cats = categories.filter(c => c.level === level);
  const total = cats.reduce((s, c) => s + (vocabulary[c.id]?.length ?? 0), 0);
  const known = cats.reduce((s, c) => s + getKnownCount(progress[c.id]), 0);
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;
  return { total, known, pct };
}

function getLevelUnlocked(level, categories, vocabulary, progress, threshold) {
  if (level === 'A1') return true;
  const prev = LEVELS[LEVELS.indexOf(level) - 1];
  return getLevelStats(prev, categories, vocabulary, progress).pct >= Math.round(threshold * 100);
}

export default function ProgressPage({ langConfig, progress, streak, firstUseDate, dailySession, onReset, userId, nickname }) {
  if (!langConfig) return null;
  const { categories, vocabulary, levelColors, threshold } = langConfig;

  const totalWords  = Object.values(vocabulary).flat().length;
  const learnedWords = Object.values(progress).reduce((s, p) => s + getKnownCount(p), 0);
  const masteredWords = Object.values(progress).reduce((s, p) => s + getMasteredCount(p), 0);
  const overallPct  = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;

  const medal = OVERALL_MEDALS.find(m => overallPct >= m.min);

  const [now] = useState(() => Date.now());
  const daysSince = firstUseDate
    ? Math.max(1, Math.floor((now - new Date(firstUseDate).getTime()) / 86400000) + 1)
    : 1;

  const accuracy = dailySession.totalCards > 0
    ? Math.round((dailySession.correctCount / dailySession.totalCards) * 100)
    : null;

  const circumference = 2 * Math.PI * 50;

  return (
    <div className="page progress-page">

      {/* ── Profil ── */}
      {nickname && (
        <div className="profile-card">
          <div className="profile-avatar">
            {nickname.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <div className="profile-name">{nickname}</div>
            <div className="profile-id">#{userId ? userId.slice(-6).toUpperCase() : '------'}</div>
          </div>
          <div className="profile-anon-badge">Anonim</div>
        </div>
      )}

      {/* ── Genel ilerleme ── */}
      <div className="overall-card">
        <div className="overall-circle">
          <svg viewBox="0 0 120 120" className="progress-circle">
            <circle cx="60" cy="60" r="50" fill="none" className="circle-track" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              className="circle-progress"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - overallPct / 100)}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="circle-label">
            <span className="circle-pct">{overallPct}%</span>
            <span className="circle-sub">tamamlandı</span>
          </div>
        </div>
        <div className="overall-right">
          <div className="overall-medal">{medal.label}</div>
          {masteredWords > 0 && (
            <div className="overall-mastered">⭐ {masteredWords} öğrenildi</div>
          )}
          <div className="overall-stats-row">
            <div className="os-chip">
              <span className="os-val">{streak?.count ?? 0}</span>
              <span className="os-lbl">🔥 seri</span>
            </div>
            <div className="os-chip">
              <span className="os-val">{daysSince}</span>
              <span className="os-lbl">📅 gün</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bugünkü antrenman ── */}
      {dailySession.totalCards > 0 && (
        <div className="stats-card today-card">
          <div className="stats-card-title">Bugünkü Antrenman</div>
          <div className="today-row">
            <div className="today-chip">
              <span className="today-val">{dailySession.totalCards}</span>
              <span className="today-lbl">kart</span>
            </div>
            <div className="today-chip">
              <span className="today-val">{dailySession.newCount}</span>
              <span className="today-lbl">yeni</span>
            </div>
            {accuracy !== null && (
              <div className="today-chip">
                <span className="today-val" style={{ color: accuracy >= 70 ? '#34D399' : '#F87171' }}>
                  %{accuracy}
                </span>
                <span className="today-lbl">doğru</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Seviye barları ── */}
      <div className="level-bars-section">
        <div className="section-title">Seviyeler</div>
        {LEVELS.map(level => {
          const { pct } = getLevelStats(level, categories, vocabulary, progress);
          const unlocked = getLevelUnlocked(level, categories, vocabulary, progress, threshold);
          const motivation = getMotivation(level, unlocked ? pct : 0);
          const color = unlocked ? (levelColors[level] ?? '#818CF8') : 'var(--text-muted)';

          return (
            <div key={level} className={`level-bar-row${!unlocked ? ' locked' : ''}`}>
              <div className="lbr-header">
                <div className="lbr-left">
                  <span className="lbr-badge" style={{ background: color }}>{level}</span>
                  <span className="lbr-motivation">{motivation}</span>
                </div>
                <span className="lbr-pct" style={{ color: unlocked ? color : 'var(--text-muted)' }}>
                  {unlocked ? `${pct}%` : '🔒'}
                </span>
              </div>
              <div className="lbr-track">
                <div
                  className="lbr-fill"
                  style={{
                    width: unlocked ? `${pct}%` : '0%',
                    background: color,
                    transition: 'width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sıfırla ── */}
      <div style={{ marginTop: 32 }}>
        <button className="btn-danger" onClick={onReset}>
          İlerlemeyi Sıfırla
        </button>
      </div>
    </div>
  );
}
