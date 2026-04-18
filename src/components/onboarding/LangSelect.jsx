export default function LangSelect({ onSelect }) {
  const langs = [
    { code: 'fr', flag: '🇫🇷', name: 'Fransızca', sub: '14.000+ kelime · A1→C1' },
    { code: 'en', flag: '🇬🇧', name: 'İngilizce', sub: '9.000+ kelime · A1→C1' },
    { code: 'de', flag: '🇩🇪', name: 'Almanca', sub: '8.500+ kelime · A1→C1' },
  ]
  return (
    <div className="ob-body">
      <div>
        <div className="ob-title">Hangi dili öğrenmek istiyorsun?</div>
      </div>
      <div className="ob-lang-options">
        {langs.map(l => (
          <button key={l.code} className="ob-lang-btn" onClick={() => onSelect(l.code)}>
            <span className="ob-lang-flag">{l.flag}</span>
            <div className="ob-lang-info">
              <div className="ob-lang-name">{l.name}</div>
              <div className="ob-lang-sub">{l.sub}</div>
            </div>
            <span className="ob-lang-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
