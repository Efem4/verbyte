import { useRef, useEffect, useState } from 'react'
import './BottomNav.css'

const TABS = [
  { id: 'cards',    icon: '🃏', label: 'Kartlar'  },
  { id: 'quiz',     icon: '⚡', label: 'Quiz'     },
  { id: 'practice', icon: '✍️', label: 'Pratik'   },
  { id: 'kesf',     icon: '🧭', label: 'Keşif'    },
]

function lerp(a, b, t) { return a + (b - a) * t; }

export default function BottomNav({ activeTab, onTabChange, swipeFrac = null }) {
  const navRef = useRef(null)
  const tabPos = useRef([])
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })

  // Tab pozisyonlarını ölç (mount + resize)
  useEffect(() => {
    function measure() {
      if (!navRef.current) return
      const tabs = navRef.current.querySelectorAll('.nav-tab')
      tabPos.current = Array.from(tabs).map(el => ({
        left:  el.offsetLeft + 8,
        width: el.offsetWidth - 16,
      }))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Pill → aktif tab'a snap (swipe olmadığında)
  useEffect(() => {
    if (swipeFrac !== null) return
    if (!navRef.current) return
    const idx = TABS.findIndex(t => t.id === activeTab)
    const tabs = navRef.current.querySelectorAll('.nav-tab')
    if (tabs[idx]) {
      setPillStyle({ left: tabs[idx].offsetLeft + 8, width: tabs[idx].offsetWidth - 16 })
    }
  }, [activeTab, swipeFrac])

  // Pill → swipe sırasında interpolate
  useEffect(() => {
    if (swipeFrac === null) return
    const pos = tabPos.current
    if (pos.length < 2) return
    const clamped = Math.max(0, Math.min(pos.length - 1, swipeFrac))
    const i = Math.min(Math.floor(clamped), pos.length - 2)
    const t = clamped - i
    setPillStyle({
      left:  lerp(pos[i].left,  pos[i + 1].left,  t),
      width: lerp(pos[i].width, pos[i + 1].width, t),
    })
  }, [swipeFrac])

  const dragging = swipeFrac !== null

  return (
    <nav className="bottom-nav">
      <div className="nav-tabs" ref={navRef}>
        <div
          className={`nav-pill${dragging ? ' nav-pill--drag' : ''}`}
          style={pillStyle}
        />
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            <span className="nav-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
