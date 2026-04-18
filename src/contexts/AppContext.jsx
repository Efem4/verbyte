import { createContext, useContext, useReducer, useEffect } from 'react'

// ─── Initial State ───────────────────────────────────────────────────────────

const initialState = {
  langCode: null,
  langConfig: null,
  tab: 'cards',
  progressByLang: { fr: {}, en: {}, de: {} },
  sentProgressByLang: { fr: {}, en: {}, de: {} },
  streak: { count: 0, lastDate: null },
  theme: 'dark',
  onboarded: false,
  dailyGoal: 10,
  userLevel: 'A1',
  settingsByLang: {},   // { fr: { dailyGoal, userLevel }, en: {...} }
  nickname: localStorage.getItem('vb_nickname') || null,
  todayCount: 0,
  todayDate: new Date().toISOString().slice(0, 10),
}

// ─── localStorage Initializer ─────────────────────────────────────────────────

function localStorageInitializer(init) {
  return {
    ...init,
    theme: localStorage.getItem('verbyte_theme') || 'dark',
    onboarded: !!localStorage.getItem('verbyte_onboarded'),
    dailyGoal: Number(localStorage.getItem('verbyte_daily_goal')) || 10,
    userLevel: localStorage.getItem('verbyte_user_level') || 'A1',
    progressByLang: {
      fr: JSON.parse(localStorage.getItem('fr_progress') || '{}'),
      en: JSON.parse(localStorage.getItem('en_progress') || '{}'),
      de: JSON.parse(localStorage.getItem('de_progress') || '{}'),
    },
    sentProgressByLang: {
      fr: JSON.parse(localStorage.getItem('fr_sent_progress') || '{}'),
      en: JSON.parse(localStorage.getItem('en_sent_progress') || '{}'),
      de: JSON.parse(localStorage.getItem('de_sent_progress') || '{}'),
    },
    streak: JSON.parse(localStorage.getItem('verbyte_streak') || '{"count":0,"lastDate":null}'),
    settingsByLang: JSON.parse(localStorage.getItem('verbyte_settings_by_lang') || '{}'),
    todayCount: (() => {
      const saved = JSON.parse(localStorage.getItem('verbyte_today') || 'null')
      const today = new Date().toISOString().slice(0, 10)
      return saved?.date === today ? saved.count : 0
    })(),
    todayDate: new Date().toISOString().slice(0, 10),
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, langCode: action.payload }

    case 'SET_LANG_CONFIG':
      return { ...state, langConfig: action.payload }

    case 'SET_TAB':
      return { ...state, tab: action.payload }

    case 'UPDATE_PROGRESS': {
      const { lang, catId, word, entry } = action.payload
      return {
        ...state,
        progressByLang: {
          ...state.progressByLang,
          [lang]: {
            ...state.progressByLang[lang],
            [catId]: {
              ...state.progressByLang[lang]?.[catId],
              [word]: entry,
            },
          },
        },
      }
    }

    case 'UPDATE_SENT_PROGRESS': {
      const { lang, catId, sentId, entry } = action.payload
      return {
        ...state,
        sentProgressByLang: {
          ...state.sentProgressByLang,
          [lang]: {
            ...state.sentProgressByLang[lang],
            [catId]: {
              ...state.sentProgressByLang[lang]?.[catId],
              [sentId]: entry,
            },
          },
        },
      }
    }

    case 'UPDATE_STREAK':
      return { ...state, streak: action.payload }

    case 'SET_THEME':
      return { ...state, theme: action.payload }

    case 'COMPLETE_ONBOARDING': {
      const { langCode, dailyGoal, userLevel, nickname } = action.payload
      localStorage.setItem('verbyte_lang', langCode)
      if (nickname) localStorage.setItem('vb_nickname', nickname)
      const updatedSettings = {
        ...state.settingsByLang,
        [langCode]: { dailyGoal, userLevel },
      }
      return {
        ...state,
        onboarded: true,
        langCode,
        dailyGoal,
        userLevel,
        settingsByLang: updatedSettings,
        nickname: nickname ?? state.nickname,
      }
    }

    case 'RESET_ONBOARDING':
      localStorage.removeItem('verbyte_onboarded')
      return { ...state, onboarded: false }

    case 'INCREMENT_TODAY':
      return { ...state, todayCount: state.todayCount + 1 }

    case 'RESET_LANG_PROGRESS': {
      const { lang } = action.payload
      return {
        ...state,
        progressByLang: {
          ...state.progressByLang,
          [lang]: {},
        },
        sentProgressByLang: {
          ...state.sentProgressByLang,
          [lang]: {},
        },
      }
    }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AppContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState, localStorageInitializer)

  // theme — data-theme attribute + localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
    localStorage.setItem('verbyte_theme', state.theme)
  }, [state.theme])

  // progress — localStorage
  useEffect(() => {
    localStorage.setItem('fr_progress', JSON.stringify(state.progressByLang.fr))
    localStorage.setItem('en_progress', JSON.stringify(state.progressByLang.en))
    localStorage.setItem('de_progress', JSON.stringify(state.progressByLang.de))
  }, [state.progressByLang])

  // sentProgress — localStorage
  useEffect(() => {
    localStorage.setItem('fr_sent_progress', JSON.stringify(state.sentProgressByLang.fr))
    localStorage.setItem('en_sent_progress', JSON.stringify(state.sentProgressByLang.en))
    localStorage.setItem('de_sent_progress', JSON.stringify(state.sentProgressByLang.de))
  }, [state.sentProgressByLang])

  // streak — localStorage
  useEffect(() => {
    localStorage.setItem('verbyte_streak', JSON.stringify(state.streak))
  }, [state.streak])

  // onboarding settings — localStorage
  useEffect(() => {
    if (state.onboarded) {
      localStorage.setItem('verbyte_onboarded', '1')
    }
    localStorage.setItem('verbyte_daily_goal', String(state.dailyGoal))
    localStorage.setItem('verbyte_user_level', state.userLevel)
    localStorage.setItem('verbyte_settings_by_lang', JSON.stringify(state.settingsByLang))
  }, [state.onboarded, state.dailyGoal, state.userLevel, state.settingsByLang])

  // todayCount — localStorage (tarih ile birlikte)
  useEffect(() => {
    localStorage.setItem(
      'verbyte_today',
      JSON.stringify({ count: state.todayCount, date: state.todayDate })
    )
  }, [state.todayCount, state.todayDate])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

// ─── useApp (re-export için) ──────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
