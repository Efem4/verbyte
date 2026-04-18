import { Flame, BarChart2, Sun, Moon } from 'lucide-react'
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
            <Flame size={16} strokeWidth={1.5} />
            <span>{streak.count}</span>
          </div>
        )}
        <button className="header-icon-btn" onClick={onProgressOpen} title="İstatistikler">
          <BarChart2 size={20} strokeWidth={1.5} />
        </button>
        <button className="header-icon-btn" onClick={onThemeToggle} title="Tema">
          {theme === 'dark' ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
        </button>
      </div>
    </header>
  )
}
