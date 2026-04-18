export default function GoalSelect({ selected, onSelect, onNext }) {
  const goals = [
    { value: 5,  label: '5 kelime / gün',  tag: 'Rahat' },
    { value: 10, label: '10 kelime / gün', tag: 'Orta' },
    { value: 15, label: '15 kelime / gün', tag: 'Ciddi' },
    { value: 20, label: '20 kelime / gün', tag: 'Yoğun' },
  ]
  return (
    <div className="ob-body">
      <div>
        <div className="ob-title">Günlük hedefin ne?</div>
        <div className="ob-subtitle">Her gün birkaç dakika yeterli</div>
      </div>
      <div className="ob-options">
        {goals.map(g => (
          <button
            key={g.value}
            className={`ob-option ${selected === g.value ? 'selected' : ''}`}
            onClick={() => { onSelect(g.value); setTimeout(onNext, 200) }}
          >
            <span>{g.label}</span>
            <span className="ob-option-tag">{g.tag}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
