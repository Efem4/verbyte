import './Header.css'

export default function Header({ langCode, streak, theme, onThemeToggle, onLogoClick, onProgressOpen }) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo" onClick={onLogoClick} style={{ cursor: 'pointer' }}>Verbyte</span>
      </div>

      <div className="header-right">
        {streak?.count > 0 && (
          <div className="header-streak">
            🔥 <span>{streak.count}</span>
          </div>
        )}
        <button className="header-icon-btn" onClick={onProgressOpen} title="İstatistikler">📊</button>
        <button className="header-icon-btn" onClick={onThemeToggle} title="Tema">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
