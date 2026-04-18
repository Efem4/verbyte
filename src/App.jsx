import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './hooks/useApp';
import { useUser } from './hooks/useUser';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import FlashcardPage from './components/FlashcardPage';
import DeckPage from './components/DeckPage';
import SentenceFlashcardPage from './components/SentenceFlashcardPage';
import SentencesPage from './components/SentencesPage';
import KesfPage from './components/KesfPage';

function CardPanel({ langConfig, progress, onProgress, onDeckActiveChange, onDeckStart, onStudy, onComboChange, onLoadLevel, dailyNewRemaining, dailySlotWords, slotReady, dailyGoal, firstUseDate }) {
  const [cardMode, setCardMode] = useState('word');
  const [isDailyActive, setIsDailyActive] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!isDailyActive && (
        <div className="card-mode-chips">
          <button
            className={`cmc-btn${cardMode === 'word' ? ' active' : ''}`}
            onClick={() => setCardMode('word')}
          >Kelime</button>
          <button
            className={`cmc-btn${cardMode === 'sent' ? ' active' : ''}`}
            onClick={() => setCardMode('sent')}
          >Cümle</button>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {cardMode === 'word'
          ? <FlashcardPage
              langConfig={langConfig}
              progress={progress}
              onProgress={onProgress}
              onDeckActiveChange={onDeckActiveChange}
              onDeckStart={onDeckStart}
              onStudy={onStudy}
              onComboChange={onComboChange}
              onLoadLevel={onLoadLevel}
              dailyNewRemaining={dailyNewRemaining}
              onSwitchToSentences={() => setCardMode('sent')}
              dailySlotWords={dailySlotWords}
              slotReady={slotReady}
              onDailyStart={(active) => setIsDailyActive(active ?? true)}
              dailyGoal={dailyGoal}
              firstUseDate={firstUseDate}
            />
          : <SentenceFlashcardPage langConfig={langConfig} />
        }
      </div>
    </div>
  );
}
import ProgressPage from './components/ProgressPage';
import QuizPage from './components/QuizPage';
import AchievementToast from './components/AchievementToast';
import { LANGS, LEVELS, loadLangConfig, loadLevel, UNLOCK_THRESHOLD } from './config/languageRegistry';
import { migrateProgress, updateEntry, getMasteredCount, getDailyLimit } from './utils/srs';
import { ACHIEVEMENTS, checkNew, loadEarned, saveEarned } from './utils/achievements';
import { logger } from './utils/logger';
import { getDailySlot } from './utils/slotEngine.js';
import './App.css';
import './components/QuizPage.css';

function loadTheme() {
  return localStorage.getItem('verbyte_theme') || 'dark';
}

const STREAK_TIERS = [
  { min: 25, color: '#F59E0B', glow: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.4)', label: '✨ Efsane' },
  { min: 15, color: '#A855F7', glow: 'rgba(168,85,247,0.5)', bg: 'rgba(168,85,247,0.18)', border: 'rgba(168,85,247,0.4)', label: '🔮 Alev' },
  { min: 10, color: '#EF4444', glow: 'rgba(239,68,68,0.5)',  bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.4)',  label: '🌋 Kor' },
  { min: 5,  color: '#F97316', glow: 'rgba(249,115,22,0.5)', bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.4)', label: '🔥 Ateşlendi' },
  { min: 0,  color: '#9CA3AF', glow: 'none',                 bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.25)', label: '💤 Başlangıç' },
];

function getStreakTier(count) {
  return STREAK_TIERS.find((t) => count >= t.min);
}

function loadStreak() {
  try {
    return JSON.parse(localStorage.getItem('verbyte_streak')) || { count: 0, lastDate: null };
  } catch {
    return { count: 0, lastDate: null };
  }
}

function loadFirstUse() {
  const stored = localStorage.getItem('verbyte_first_use');
  if (stored) return stored;
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('verbyte_first_use', today);
  return today;
}

function loadDailySession(langCode) {
  const today = new Date().toISOString().split('T')[0];
  try {
    return JSON.parse(localStorage.getItem(`verbyte_daily_${langCode}_${today}`)) || { newCount: 0, totalCards: 0, correctCount: 0 };
  } catch {
    return { newCount: 0, totalCards: 0, correctCount: 0 };
  }
}

function saveDailySession(langCode, session) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(`verbyte_daily_${langCode}_${today}`, JSON.stringify(session));
}

function touchStreak(prev, session) {
  const today = new Date().toISOString().split('T')[0];
  if (prev.lastDate === today) return prev;
  // Kalite şartı: min 10 kart + %70 doğru
  if (session.totalCards < 10) return prev;
  if (session.totalCards > 0 && session.correctCount / session.totalCards < 0.7) return prev;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const next = { count: prev.lastDate === yesterday ? prev.count + 1 : 1, lastDate: today };
  localStorage.setItem('verbyte_streak', JSON.stringify(next));
  return next;
}

function loadProgress(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function saveProgress(key, progress) {
  localStorage.setItem(key, JSON.stringify(progress));
}

function createInitialProgressMap() {
  const map = {};
  for (const lang of LANGS) {
    const key = `${lang.code}_progress`;
    const raw = loadProgress(key);
    const needsMigration = Object.values(raw).some((v) => Array.isArray(v));
    const progress = needsMigration ? migrateProgress(raw) : raw;
    if (needsMigration) saveProgress(key, progress);
    map[lang.code] = progress;
  }
  return map;
}

function getTotals(progressByLang) {
  let totalWords = 0;
  let mastered = 0;
  for (const langProgress of Object.values(progressByLang)) {
    for (const catProgress of Object.values(langProgress)) {
      totalWords += Object.keys(catProgress || {}).length;
      mastered += getMasteredCount(catProgress);
    }
  }
  return { totalWords, mastered };
}

export default function App() {
  const { onboarded, langCode: ctxLangCode, dailyGoal, userLevel, resetOnboarding } = useApp();
  const { userId, nickname, syncToCloud } = useUser();

  const [theme, setTheme] = useState(loadTheme);
  const [langCode, setLangCode] = useState(() =>
    localStorage.getItem('verbyte_lang') || ctxLangCode || null
  );
  // Context'ten gelen langCode değişince yerel state'i güncelle (onboarding sonrası)
  useEffect(() => {
    if (ctxLangCode && ctxLangCode !== langCode) {
      setLangCode(ctxLangCode);
    }
  }, [ctxLangCode]);
  // BottomNav tab id'leri: 'cards' | 'quiz' | 'practice'
  // App içi tab değerleri: 'flashcards' | 'quiz' | 'sentences'
  const [tab, setTab] = useState('cards');
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [deckActive, setDeckActive] = useState(false);
  const [deckState, setDeckState] = useState(null);

  function handleDeckStart(info) {
    setDeckState(info);
    setDeckActive(true);
  }

  function handleDeckClose() {
    setDeckState(null);
    setDeckActive(false);
  }

  // ── Swipe navigation ──
  const TABS_ORDER = ['cards', 'quiz', 'practice', 'kesf'];
  const swipeRef = useRef({ x: 0, y: 0, tracking: false });
  const [swipeFrac, setSwipeFrac] = useState(null);

  function onSwipeStart(e) {
    if (deckActive) return;
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, tracking: true };
  }
  function onSwipeMove(e) {
    if (!swipeRef.current.tracking) return;
    const dx = e.touches[0].clientX - swipeRef.current.x;
    const dy = e.touches[0].clientY - swipeRef.current.y;
    if (Math.abs(dy) > Math.abs(dx)) {
      swipeRef.current.tracking = false;
      setSwipeFrac(null);
      return;
    }
    const idx = TABS_ORDER.indexOf(tab);
    const frac = idx - dx / window.innerWidth;
    setSwipeFrac(Math.max(0, Math.min(TABS_ORDER.length - 1, frac)));
  }
  function onSwipeEnd(e) {
    if (!swipeRef.current.tracking) return;
    swipeRef.current.tracking = false;
    const dx = e.changedTouches[0].clientX - swipeRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeRef.current.y;
    setSwipeFrac(null);
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60) return;
    const idx = TABS_ORDER.indexOf(tab);
    const next = dx < 0 ? idx + 1 : idx - 1;
    if (next >= 0 && next < TABS_ORDER.length) setTab(TABS_ORDER[next]);
  }
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [progressByLang, setProgressByLang] = useState(createInitialProgressMap);
  const [streak, setStreak] = useState(loadStreak);
  const [earned, setEarned] = useState(loadEarned);
  const [todayCount, setTodayCount] = useState(() => {
    const saved = localStorage.getItem('verbyte_today');
    const d = JSON.parse(saved || '{}');
    return d.date === new Date().toDateString() ? (d.count || 0) : 0;
  });
  const [toastQueue, setToastQueue] = useState([]);
  const comboRef = useRef(0);
  const [firstUseDate] = useState(loadFirstUse);
  const dailySessionRef = useRef({});
  const [dailySession, setDailySession] = useState(() =>
    langCode ? (loadDailySession(langCode)) : { newCount: 0, totalCards: 0, correctCount: 0 }
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('verbyte_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const [langConfig, setLangConfig] = useState(null);
  const [dailySlotWords, setDailySlotWords] = useState([]);
  const [slotReady, setSlotReady] = useState(false);

  useEffect(() => {
    if (!langCode) return;
    let active = true;
    loadLangConfig(langCode).then(config => {
      if (!active) return;
      setLangConfig(config);
    }).catch(() => {});
    return () => { active = false; };
  }, [langCode]);

  // langConfig hazır olunca günlük slot'u doldur
  useEffect(() => {
    if (!langConfig?.vocabulary) return;
    const { words } = getDailySlot(
      langCode,
      langConfig.vocabulary,
      progressByLang[langCode] || {},
      langConfig.wordKey,
      dailyGoal ?? 10
    );
    setDailySlotWords(words);
    setSlotReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig, langCode]);

  // userLevel A1 değilse tüm levelleri pre-load et
  useEffect(() => {
    if (!langConfig || !langCode) return;
    if (userLevel && userLevel !== 'A1') {
      const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
      ALL_LEVELS.forEach(lv => {
        loadLevel(langCode, lv).then(config => {
          setLangConfig(config);
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig?.loadedLevels?.size, langCode, userLevel]);

  // Kilit açılan seviyeleri otomatik yükle
  useEffect(() => {
    if (!langConfig || !langCode) return;
    const { categories, vocabulary, loadedLevels } = langConfig;
    const prog = progressByLang[langCode] || {};

    for (let i = 1; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      if (loadedLevels.has(level)) continue;
      // Önceki seviyenin progress'ini kontrol et
      const prevLevel = LEVELS[i - 1];
      if (!loadedLevels.has(prevLevel)) break;
      const prevCats = categories.filter(c => c.level === prevLevel);
      const total = prevCats.reduce((s, c) => s + (vocabulary[c.id]?.length ?? 0), 0);
      const known = prevCats.reduce((s, c) => s + Object.keys(prog[c.id] || {}).length, 0);
      if (total > 0 && known / total >= UNLOCK_THRESHOLD) {
        loadLevel(langCode, level).then(config => setLangConfig(config));
      } else {
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langConfig?.loadedLevels?.size, langCode, progressByLang]);

  function handleLoadLevel(level) {
    if (!langCode) return;
    loadLevel(langCode, level).then(config => setLangConfig(config));
  }

  const progress = langCode ? progressByLang[langCode] || {} : {};
  const dailyLimit = getDailyLimit(firstUseDate);
  const dailyNewRemaining = Math.max(0, dailyLimit - dailySession.newCount);

  const triggerAchievements = useCallback((params) => {
    setEarned((prevEarned) => {
      const newOnes = checkNew(prevEarned, params);
      if (newOnes.length === 0) return prevEarned;
      const updated = new Set([...prevEarned, ...newOnes.map((a) => a.id)]);
      saveEarned(updated);
      setToastQueue((q) => [...q, ...newOnes]);
      newOnes.forEach((a) => logger.log('achievement', `kazanıldı: ${a.label}`, { id: a.id }));
      return updated;
    });
  }, []);

  function setProgress(updater) {
    if (!langCode) return;
    const key = `${langCode}_progress`;
    setProgressByLang((prev) => {
      const current = prev[langCode] || {};
      const next = updater(current);
      saveProgress(key, next);
      const updated = { ...prev, [langCode]: next };
      const { totalWords, mastered } = getTotals(updated);
      triggerAchievements({ streak: streak.count, combo: comboRef.current, totalWords, mastered });
      return updated;
    });
  }

  function handleProgress(categoryId, word, correct, isNew) {
    if (langCode) {
      const session = dailySessionRef.current[langCode] || loadDailySession(langCode);
      const updated = {
        newCount: session.newCount + (isNew ? 1 : 0),
        totalCards: session.totalCards + 1,
        correctCount: session.correctCount + (correct ? 1 : 0),
      };
      dailySessionRef.current[langCode] = updated;
      setDailySession(updated);
      saveDailySession(langCode, updated);
    }
    setProgress((prev) => {
      const catProgress = prev[categoryId] || {};
      const entry = catProgress[word];
      const updatedEntry = updateEntry(entry, correct);
      logger.log('progress', `${correct ? '✓' : '✗'} ${word}`, { cat: categoryId, interval: updatedEntry.interval });
      return { ...prev, [categoryId]: { ...catProgress, [word]: updatedEntry } };
    });
  }

  function handleStudy() {
    if (!langCode) return;
    setTodayCount(n => {
      const next = n + 1;
      localStorage.setItem('verbyte_today', JSON.stringify({ date: new Date().toDateString(), count: next }));
      return next;
    });
    const session = dailySessionRef.current[langCode] || loadDailySession(langCode);
    setStreak((prev) => {
      const next = touchStreak(prev, session);
      if (next.count !== prev.count) logger.log('streak', `${prev.count} → ${next.count}`);
      const { totalWords, mastered } = getTotals(progressByLang);
      triggerAchievements({ streak: next.count, combo: comboRef.current, totalWords, mastered });
      // Buluta sync et (fire-and-forget)
      syncToCloud({ progressByLang, streak: next, langCode, dailyGoal, userLevel, theme, firstUseDate });
      return next;
    });
  }

  function handleComboChange(n) {
    comboRef.current = n;
    const { totalWords, mastered } = getTotals(progressByLang);
    triggerAchievements({ streak: streak.count, combo: n, totalWords, mastered });
  }

  function handleReset() {
    if (!window.confirm('Tüm ilerleme sıfırlanacak. Emin misin?')) return;
    logger.log('system', `progress sıfırlandı: ${langCode}`);
    setProgress(() => ({}));
  }

  function dismissToast() {
    setToastQueue((q) => q.slice(1));
  }

  // Onboarding gate — henüz onboard olmamışsa OnboardingFlow göster
  if (!onboarded) {
    return <OnboardingFlow />;
  }

  // langConfig henüz hazır değilse bileşenler kendi null guard'larıyla bekler

  // Deck açıksa sadece DeckPage döndür
  if (deckState) {
    return (
      <div className="app" data-theme={theme}>
        <DeckPage
          deckState={deckState}
          langConfig={langConfig}
          progress={progress}
          onProgress={handleProgress}
          onStudy={handleStudy}
          onBack={handleDeckClose}
          onLoadLevel={handleLoadLevel}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {toastQueue.length > 0 && (
        <AchievementToast achievement={toastQueue[0]} onDismiss={dismissToast} />
      )}

      <Header
        langCode={langCode}
        streak={streak}
        theme={theme}
        onThemeToggle={toggleTheme}
        onLogoClick={resetOnboarding}
        onProgressOpen={() => setAchievementsOpen(true)}
      />

      {achievementsOpen && (
        <div className="achievements-overlay" onClick={() => setAchievementsOpen(false)}>
          <div className="achievements-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="sheet-close" onClick={() => setAchievementsOpen(false)}>✕</button>

            {/* ── Sabit istatistikler ── */}
            {(() => {
              const tier = getStreakTier(streak.count);
              return (
                <div className="psheet-stats-grid">
                  <div className="psg-cell">
                    <span className="psg-val" style={{ color: tier.color }}>{streak.count}</span>
                    <span className="psg-key">gün serisi</span>
                  </div>
                  <div className="psg-cell">
                    <span className="psg-val">{dailySession.totalCards ?? 0}</span>
                    <span className="psg-key">bugün kart</span>
                  </div>
                  <div className="psg-cell">
                    <span className="psg-val">{getTotals(progressByLang).totalWords}</span>
                    <span className="psg-key">toplam kelime</span>
                  </div>
                </div>
              );
            })()}

            {/* ── Rozetler accordion ── */}
            <button className="psheet-acc-btn" onClick={() => setBadgesOpen((v) => !v)}>
              <span>Rozetler</span>
              <span className="psheet-acc-count">{earned ? [...earned].length : 0}/{ACHIEVEMENTS.length}</span>
              <span className="psheet-acc-arrow">{badgesOpen ? '▲' : '›'}</span>
            </button>
            {badgesOpen && (
              <div className="psheet-acc-body">
                {[
                  { key: 'streak', label: 'Seri' },
                  { key: 'combo', label: 'Combo' },
                  { key: 'words', label: 'Kelime' },
                  { key: 'mastery', label: 'Ustalık' },
                ].map(({ key, label }) => (
                  <div key={key} className="achievement-group">
                    <div className="achievement-group-label">{label}</div>
                    <div className="achievement-row">
                      {ACHIEVEMENTS.filter((a) => a.category === key).map((a) => {
                        const unlocked = earned?.has(a.id);
                        return (
                          <div key={a.id} className={`achievement-card${unlocked ? ' unlocked' : ''}`}>
                            <span className="achievement-icon">{unlocked ? a.icon : '—'}</span>
                            <span className="achievement-name">{a.label}</span>
                            <span className="achievement-desc">{a.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Detaylı istatistik accordion ── */}
            <button className="psheet-acc-btn" onClick={() => setStatsOpen((v) => !v)}>
              <span>Detaylı İstatistik</span>
              <span className="psheet-acc-arrow">{statsOpen ? '▲' : '›'}</span>
            </button>
            {statsOpen && (
              <div className="psheet-acc-body">
                <ProgressPage
                  langConfig={langConfig}
                  progress={progress}
                  streak={streak}
                  firstUseDate={firstUseDate}
                  dailySession={dailySession}
                  onReset={handleReset}
                  userId={userId}
                  nickname={nickname}
                  embedded
                />
              </div>
            )}
          </div>
        </div>
      )}

      {langCode && (
        <div className="daily-summary">
          <span>🔥 {streak.count} gün</span>
          <span>📚 Bugün {todayCount} kart</span>
        </div>
      )}

      <main
        className={`app-main${tab === 'cards' && deckActive ? ' app-main--locked' : ''}`}
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
      >
        {tab === 'cards' && (
          <CardPanel
            langConfig={langConfig}
            progress={progress}
            onProgress={handleProgress}
            onDeckActiveChange={setDeckActive}
            onDeckStart={handleDeckStart}
            onStudy={handleStudy}
            onComboChange={handleComboChange}
            onLoadLevel={handleLoadLevel}
            dailyNewRemaining={dailyNewRemaining}
            dailySlotWords={dailySlotWords}
            slotReady={slotReady}
            dailyGoal={dailyGoal}
            firstUseDate={firstUseDate}
          />
        )}
        {tab === 'quiz' && <QuizPage langConfig={langConfig} onStudy={handleStudy} />}
        {tab === 'practice' && <SentencesPage langConfig={langConfig} onStudy={handleStudy} />}
        {tab === 'kesf' && langConfig && <KesfPage langConfig={langConfig} hasBar />}
      </main>

      <BottomNav activeTab={tab} onTabChange={setTab} swipeFrac={swipeFrac} />
    </div>
  );
}
