import { useState } from 'react'

export default function NicknameSelect({ onSelect }) {
  const [nickname, setNickname] = useState('')

  return (
    <div className="ob-body">
      <div style={{ fontSize: 72, lineHeight: 1, animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        👋
      </div>
      <div style={{ textAlign: 'center' }}>
        <div className="ob-title">Nasıl çağıralım seni?</div>
        <div className="ob-subtitle">Sadece sen göreceksin</div>
      </div>
      <input
        className="ob-nickname-input"
        type="text"
        placeholder="Takma ad..."
        maxLength={20}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        autoFocus
      />
      <button
        className="ob-cta"
        disabled={!nickname.trim()}
        onClick={() => onSelect(nickname.trim())}
      >
        Devam Et
      </button>
    </div>
  )
}
