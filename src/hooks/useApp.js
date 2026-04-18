import { useContext } from 'react'
import { AppContext } from '../contexts/AppContext'

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')

  const { state, dispatch } = ctx

  return {
    // ── State ────────────────────────────────────────────────────────────────
    langCode: state.langCode,
    langConfig: state.langConfig,
    tab: state.tab,
    progressByLang: state.progressByLang,
    sentProgressByLang: state.sentProgressByLang,
    streak: state.streak,
    theme: state.theme,
    onboarded: state.onboarded,
    dailyGoal: state.dailyGoal,
    userLevel: state.userLevel,
    settingsByLang: state.settingsByLang,
    todayCount: state.todayCount,

    // ── Actions ───────────────────────────────────────────────────────────────
    setTab: (tab) => dispatch({ type: 'SET_TAB', payload: tab }),
    setLangCode: (code) => dispatch({ type: 'SET_LANG', payload: code }),
    setLangConfig: (config) => dispatch({ type: 'SET_LANG_CONFIG', payload: config }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
    updateProgress: (lang, catId, word, entry) =>
      dispatch({ type: 'UPDATE_PROGRESS', payload: { lang, catId, word, entry } }),
    updateSentProgress: (lang, catId, sentId, entry) =>
      dispatch({ type: 'UPDATE_SENT_PROGRESS', payload: { lang, catId, sentId, entry } }),
    updateStreak: (streak) => dispatch({ type: 'UPDATE_STREAK', payload: streak }),
    completeOnboarding: (langCode, dailyGoal, userLevel, nickname) =>
      dispatch({ type: 'COMPLETE_ONBOARDING', payload: { langCode, dailyGoal, userLevel, nickname } }),
    resetOnboarding: () => dispatch({ type: 'RESET_ONBOARDING' }),
    incrementToday: () => dispatch({ type: 'INCREMENT_TODAY' }),
    resetLangProgress: (lang) => dispatch({ type: 'RESET_LANG_PROGRESS', payload: { lang } }),
  }
}
