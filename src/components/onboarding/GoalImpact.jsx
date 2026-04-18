export default function GoalImpact({ goal, onNext }) {
  const g = goal || 10
  const year = g * 365
  const week = g * 7

  const milestones = [
    { days: 7,   label: `İlk kelimeler aklında kalıcı olmaya başlar` },
    { days: 30,  label: `${g * 30} kelime — temel cümleler kurabilirsin` },
    { days: 90,  label: `${g * 90} kelime — günlük konuşmayı anlarsın` },
    { days: 365, label: `${year} kelime — neredeyse akıcısın` },
  ]

  return (
    <div className="ob-body">
      <div className="ob-impact-hero">
        <span className="ob-impact-num">{year}</span>
        <span className="ob-impact-unit">kelime / yıl</span>
        <span className="ob-impact-sub">Günde yalnızca {g} kelime ile</span>
      </div>

      <div className="ob-timeline">
        {milestones.map((m, i) => (
          <div key={i} className="ob-tl-row">
            <div className="ob-tl-dot" />
            <div className="ob-tl-content">
              <span className="ob-tl-day">{m.days} gün</span>
              <span className="ob-tl-label">{m.label}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="ob-cta" onClick={onNext}>Başlayalım →</button>
    </div>
  )
}
