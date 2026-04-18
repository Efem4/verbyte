export default function LevelSelect({ selected, onSelect, onNext }) {
  const levels = [
    { value: 'A1', label: 'Hiç bilmiyorum', sub: 'Sıfırdan başlıyorum' },
    { value: 'A2', label: 'Birkaç kelime biliyorum', sub: 'Temel seviyedeyim' },
    { value: 'B1', label: 'Temel cümle kurabilirim', sub: 'Orta seviyedeyim' },
    { value: 'B2', label: 'Akıcı konuşabilirim', sub: 'İleri seviyedeyim' },
  ]
  return (
    <div className="ob-body">
      <div>
        <div className="ob-title">Dilde neredesin?</div>
        <div className="ob-subtitle">Sana özel bir yol hazırlayalım</div>
      </div>
      <div className="ob-options">
        {levels.map((l, i) => (
          <button
            key={i}
            className={`ob-option ${selected === l.value && i === levels.findIndex(x => x.value === selected) ? 'selected' : ''}`}
            onClick={() => { onSelect(l.value); setTimeout(onNext, 180) }}
          >
            <div className="ob-option-left">
              <div>
                <div>{l.label}</div>
                <div className="ob-option-tag">{l.sub}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
