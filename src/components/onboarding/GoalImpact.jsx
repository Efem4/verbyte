export default function GoalImpact({ goal, onNext }) {
  const weekly = (goal || 10) * 7
  const monthly = (goal || 10) * 30
  return (
    <div className="ob-body">
      <div className="ob-impact">
        <div className="ob-impact-number">{weekly}</div>
        <div className="ob-impact-label">ilk haftada kelime 🔥</div>
        <div className="ob-impact-chips">
          <div className="ob-impact-chip">Ayda <span>{monthly}</span> kelime</div>
          <div className="ob-impact-chip">Yılda <span>{(goal||10)*365}</span> kelime</div>
        </div>
        <div className="ob-impact-sub">Günde sadece {goal || 10} kelime ile başlıyorsun.</div>
      </div>
      <button className="ob-cta" onClick={onNext}>Devam →</button>
    </div>
  )
}
