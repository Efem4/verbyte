// UUID localStorage'da saklanır, D1'e sync olur
// API_BASE = 'https://retuel-site.dry-thunder-d51e.workers.dev'

import { useState, useCallback } from 'react'

const API_BASE = 'https://retuel-site.dry-thunder-d51e.workers.dev'

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

export function useUser() {
  const [userId, setUserId] = useState(() => localStorage.getItem('vb_user_id') || null)
  const [nickname, setNickname] = useState(() => localStorage.getItem('vb_nickname') || null)
  const [syncing, setSyncing] = useState(false)

  // Kullanıcı oluştur (onboarding sonunda çağrılır)
  async function createUser(nick) {
    const id = genId()
    localStorage.setItem('vb_user_id', id)
    localStorage.setItem('vb_nickname', nick)
    setUserId(id)
    setNickname(nick)
    try {
      await fetch(`${API_BASE}/api/vb/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nickname: nick })
      })
    } catch { /* offline ok */ }
    return id
  }

  // Veriyi D1'e gönder
  const syncToCloud = useCallback(async ({ progressByLang, streak, langCode, dailyGoal, userLevel, theme, firstUseDate }) => {
    if (!userId) return
    setSyncing(true)
    try {
      await fetch(`${API_BASE}/api/vb/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          settings: { langCode, dailyGoal, userLevel, theme, firstUseDate },
          progress: progressByLang,
          streak
        })
      })
    } catch { /* offline ok */ }
    setSyncing(false)
  }, [userId])

  return { userId, nickname, createUser, syncToCloud, syncing }
}
