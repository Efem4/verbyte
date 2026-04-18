export default function OnboardingDone({ onFinish, loading }) {
  return (
    <div className="ob-body">
      <div className="ob-done">
        <div className="ob-done-icon">🚀</div>
        <div className="ob-done-title">Hazırsın!</div>
        <div className="ob-done-sub">
          {loading
            ? 'Kelimeler yükleniyor…'
            : 'Her gün birkaç dakika — farkı göreceksin.'}
        </div>
      </div>
      <button className="ob-cta" onClick={onFinish} disabled={loading}>
        {loading ? '⏳ Hazırlanıyor…' : 'Başlayalım'}
      </button>
    </div>
  )
}
