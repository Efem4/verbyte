import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { useUser } from '../../hooks/useUser'
import { loadLangConfig } from '../../config/languageRegistry'
import LangSelect from './LangSelect'
import LevelSelect from './LevelSelect'
import GoalSelect from './GoalSelect'
import GoalImpact from './GoalImpact'
import NicknameSelect from './NicknameSelect'
import OnboardingDone from './OnboardingDone'
import './Onboarding.css'

export default function OnboardingFlow() {
  const { completeOnboarding, settingsByLang } = useApp()
  const { createUser } = useUser()
  const [step, setStep] = useState(0)
  const [langLoading, setLangLoading] = useState(false)
  const [selections, setSelections] = useState({
    langCode: null,
    userLevel: null,
    dailyGoal: null,
    nickname: null,
  })

  const hasNickname = !!localStorage.getItem('vb_nickname')
  // Seçili dilin daha önce kurulumu yapılmış mı?
  const thisLangHasSettings = selections.langCode ? !!settingsByLang?.[selections.langCode] : false

  function next() { setStep(s => s + 1) }
  function back() { setStep(s => Math.max(0, s - 1)) }
  function select(key, value) { setSelections(s => ({ ...s, [key]: value })) }

  function prefetchLang(code) {
    setLangLoading(true)
    loadLangConfig(code).then(() => setLangLoading(false)).catch(() => setLangLoading(false))
  }

  function finish() {
    const nick = selections.nickname || localStorage.getItem('vb_nickname')
    const existingSettings = settingsByLang?.[selections.langCode]
    if (selections.nickname) createUser(selections.nickname)
    completeOnboarding(
      selections.langCode,
      selections.dailyGoal ?? existingSettings?.dailyGoal ?? 10,
      selections.userLevel ?? existingSettings?.userLevel ?? 'A1',
      nick
    )
  }

  // Screens: dil bazlı dinamik
  // - Dil kuruluysa (thisLangHasSettings): sadece LangSelect + Done
  // - Dil yeni, nickname var: LangSelect + Level + Goal + Impact + Done
  // - İlk kez (nickname yok): tam flow
  const screens = [
    <LangSelect key="lang" onSelect={(v) => { select('langCode', v); prefetchLang(v); next() }} />,
    ...(thisLangHasSettings
      ? []
      : hasNickname
        ? [
            <LevelSelect key="level" selected={selections.userLevel} onSelect={(v) => select('userLevel', v)} onNext={next} />,
            <GoalSelect key="goal" selected={selections.dailyGoal} onSelect={(v) => select('dailyGoal', v)} onNext={next} />,
            <GoalImpact key="impact" goal={selections.dailyGoal} onNext={next} />,
          ]
        : [
            <LevelSelect key="level" selected={selections.userLevel} onSelect={(v) => select('userLevel', v)} onNext={next} />,
            <GoalSelect key="goal" selected={selections.dailyGoal} onSelect={(v) => select('dailyGoal', v)} onNext={next} />,
            <GoalImpact key="impact" goal={selections.dailyGoal} onNext={next} />,
            <NicknameSelect key="nick" onSelect={(v) => { select('nickname', v); next() }} />,
          ]
    ),
    <OnboardingDone key="done" onFinish={finish} loading={langLoading} />,
  ]

  const STEPS = screens.length
  const progress = (step / (STEPS - 1)) * 100

  return (
    <div className="ob-shell">
      <div className="ob-progress">
        <div className="ob-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      {step > 0 && (
        <button className="ob-back" onClick={back} aria-label="Geri">←</button>
      )}
      {screens[step]}
    </div>
  )
}
