import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';
import { type, spacing, radius } from '../tokens/verbyte.tokens';
import storage from '../utils/storage';

const TIMER_SEC       = 10;
const REVEAL_DELAY    = 1400;
const PREFS_KEY       = 'verbyte_quiz_prefs';
const QUESTION_COUNTS = [10, 20, null];

// Renk sabitleri — token sistemine entegre
const CHOICE_COLORS = [
  { base: '#E53E3E', light: 'rgba(229,62,62,0.18)',  border: 'rgba(229,62,62,0.5)' },
  { base: '#3182CE', light: 'rgba(49,130,206,0.18)', border: 'rgba(49,130,206,0.5)' },
  { base: '#D69E2E', light: 'rgba(214,158,46,0.18)', border: 'rgba(214,158,46,0.5)' },
  { base: '#38A169', light: 'rgba(56,161,105,0.18)', border: 'rgba(56,161,105,0.5)' },
];
const SHAPES = ['▲', '◆', '●', '★'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(vocabulary, wordKey, count, direction) {
  const allWords = Object.entries(vocabulary || {}).flatMap(([, words]) => words.map(w => ({ ...w })));
  const pool = shuffle(allWords).slice(0, count || 100);
  return pool.map(word => {
    if (direction === 'word-tr') {
      const correct = word.tr;
      const wrongs = shuffle(allWords.filter(w => w.tr !== correct)).slice(0, 3).map(w => w.tr);
      return { question: word[wordKey], answer: correct, choices: shuffle([correct, ...wrongs]), questionIsWord: true };
    } else {
      const correct = word[wordKey];
      const wrongs = shuffle(allWords.filter(w => w[wordKey] !== correct)).slice(0, 3).map(w => w[wordKey]);
      return { question: word.tr, answer: correct, choices: shuffle([correct, ...wrongs]), questionIsWord: false };
    }
  });
}

export default function QuizScreen({ langConfig }) {
  const { c } = useTheme();
  const vocabulary = langConfig?.vocabulary ?? {};
  const wordKey    = langConfig?.wordKey ?? 'fr';
  const langLabel  = wordKey.toUpperCase();

  const [phase,         setPhase]         = useState('setup');
  const [mode,          setMode]          = useState('classic');
  const [direction,     setDirection]     = useState('tr-word');
  const [questionCount, setQuestionCount] = useState(10);
  const [showSheet,     setShowSheet]     = useState(false);
  const [questions,     setQuestions]     = useState([]);
  const [current,       setCurrent]       = useState(0);
  const [selected,      setSelected]      = useState(null);
  const [score,         setScore]         = useState(0);
  const [combo,         setCombo]         = useState(0);
  const [maxCombo,      setMaxCombo]      = useState(0);
  const [correct,       setCorrect]       = useState(0);
  const [wrong,         setWrong]         = useState(0);
  const [timeLeft,      setTimeLeft]      = useState(TIMER_SEC);
  const timerRef  = useRef(null);
  const revealRef = useRef(null);

  useEffect(() => {
    storage.getJSON(PREFS_KEY).then(p => {
      if (!p) return;
      if (p.mode)          setMode(p.mode);
      if (p.direction)     setDirection(p.direction);
      if (p.questionCount !== undefined) setQuestionCount(p.questionCount);
    });
  }, []);

  function startQuiz() {
    storage.setJSON(PREFS_KEY, { mode, direction, questionCount });
    setShowSheet(false);
    const qs = buildQuestions(vocabulary, wordKey, questionCount, direction);
    setQuestions(qs);
    setCurrent(0); setSelected(null); setScore(0);
    setCombo(0); setMaxCombo(0); setCorrect(0); setWrong(0);
    setTimeLeft(TIMER_SEC);
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing' || mode !== 'classic' || selected !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleAnswer(null); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, selected, mode]);

  function handleAnswer(choice) {
    if (selected !== null) return;
    clearInterval(timerRef.current);
    const q = questions[current];
    const isCorrect = choice === q?.answer;
    setSelected(choice ?? '__timeout__');

    let newCombo = combo, newScore = score;
    if (isCorrect) {
      newCombo = combo + 1;
      const multiplier   = Math.min(3, 1 + (newCombo - 1) * 0.5);
      const speedBonus   = mode === 'classic' ? Math.round((timeLeft / TIMER_SEC) * 100) : 0;
      newScore = score + Math.round((100 + speedBonus) * multiplier);
      setCorrect(n => n + 1);
    } else {
      newCombo = 0;
      setWrong(n => n + 1);
    }
    setCombo(newCombo);
    setMaxCombo(m => Math.max(m, newCombo));
    setScore(newScore);

    revealRef.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) setPhase('done');
      else { setCurrent(next); setSelected(null); setTimeLeft(TIMER_SEC); }
    }, REVEAL_DELAY);
  }

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearTimeout(revealRef.current);
  }, []);

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const modeLabel  = mode === 'classic' ? 'Classic' : 'Zen';
    const dirLabel   = direction === 'tr-word' ? `TR → ${langLabel}` : `${langLabel} → TR`;
    const countLabel = questionCount ?? '∞';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={s.setupCore}>
          <Text style={[type.display, { color: c.accent, letterSpacing: -1 }]}>Quiz</Text>
          <Text style={[type.body, { color: c.textMuted, marginTop: -4 }]}>Kelimeleri test et</Text>

          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: c.panel, borderColor: c.accentBorder }]}
            onPress={() => setShowSheet(true)}
            activeOpacity={0.85}
          >
            <Text style={[type.caption, { color: c.textMuted }]}>
              {modeLabel} · {countLabel} soru · {dirLabel}
            </Text>
            <Text style={[type.h2, { color: c.accent }]}>Başla →</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet */}
        <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
          <Pressable style={s.overlay} onPress={() => setShowSheet(false)} />
          <View style={[s.sheet, { backgroundColor: c.panel, borderTopColor: c.panelBorder }]}>
            <View style={[s.sheetHandle, { backgroundColor: c.hairline }]} />

            <Text style={[type.monoLabel, { color: c.textDim }]}>MOD</Text>
            <View style={s.modeRow}>
              {[['classic', '⏱', 'Classic', '10 sn, hız bonusu'], ['zen', '🧘', 'Zen', 'Süresiz']].map(([val, icon, name, desc]) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    s.modeBtn,
                    { backgroundColor: c.panelStrong, borderColor: c.panelBorder },
                    mode === val && { borderColor: c.accent, backgroundColor: c.accentTint },
                  ]}
                  onPress={() => setMode(val)}
                >
                  <Text style={{ fontSize: 24 }}>{icon}</Text>
                  <Text style={[type.bodyMd, { color: mode === val ? c.accent : c.text }]}>{name}</Text>
                  <Text style={[type.small, { color: c.textMuted, textAlign: 'center' }]}>{desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[type.monoLabel, { color: c.textDim }]}>YÖN</Text>
            <View style={s.modeRow}>
              {[['tr-word', `TR → ${langLabel}`], ['word-tr', `${langLabel} → TR`]].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    s.modeBtn,
                    { backgroundColor: c.panelStrong, borderColor: c.panelBorder },
                    direction === val && { borderColor: c.accent, backgroundColor: c.accentTint },
                  ]}
                  onPress={() => setDirection(val)}
                >
                  <Text style={[type.bodyMd, { color: direction === val ? c.accent : c.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[type.monoLabel, { color: c.textDim }]}>SORU SAYISI</Text>
            <View style={s.countRow}>
              {QUESTION_COUNTS.map(cnt => (
                <TouchableOpacity
                  key={cnt ?? 'inf'}
                  style={[
                    s.countBtn,
                    { backgroundColor: c.panelStrong, borderColor: c.panelBorder },
                    questionCount === cnt && { borderColor: c.accent, backgroundColor: c.accentTint },
                  ]}
                  onPress={() => setQuestionCount(cnt)}
                >
                  <Text style={[type.h2, { color: questionCount === cnt ? c.accent : c.text }]}>
                    {cnt ?? '∞'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.sheetStartBtn, { backgroundColor: c.primaryBtnBg }]}
              onPress={startQuiz}
              activeOpacity={0.85}
            >
              <Text style={[type.button, { color: c.primaryBtnText, fontSize: 17 }]}>Başla →</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const total    = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const grade    = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎯' : accuracy >= 50 ? '💪' : '📚';
    const msg      = accuracy >= 90 ? 'Mükemmel!' : accuracy >= 70 ? 'Harika!' : accuracy >= 50 ? 'İyi iş!' : 'Devam et!';
    const accColor = accuracy >= 70 ? c.success : accuracy >= 50 ? c.warn : c.danger;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={s.doneContainer}>
          <Text style={{ fontSize: 72 }}>{grade}</Text>
          <Text style={[type.h1, { color: c.text }]}>{msg}</Text>
          {mode === 'classic' && (
            <Text style={[type.display, { color: c.accent }]}>{score.toLocaleString()}</Text>
          )}
          <View style={s.statsRow}>
            {[
              [correct,      c.success, 'Doğru'],
              [wrong,        c.danger,  'Yanlış'],
              [`${accuracy}%`, accColor, 'Doğruluk'],
              [`${maxCombo}x`, c.text,  'Max Combo'],
            ].map(([val, color, lbl]) => (
              <View key={lbl} style={[s.statBox, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
                <Text style={[type.h2, { color }]}>{val}</Text>
                <Text style={[type.small, { color: c.textMuted, fontWeight: '600' }]}>{lbl}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[s.sheetStartBtn, { backgroundColor: c.primaryBtnBg, width: '100%' }]}
            onPress={startQuiz}
          >
            <Text style={[type.button, { color: c.primaryBtnText, fontSize: 17 }]}>Tekrar Oyna</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 14 }} onPress={() => setPhase('setup')}>
            <Text style={[type.bodyMd, { color: c.textMuted }]}>Ayarları Değiştir</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  const q = questions[current];
  if (!q) return null;
  const timerPct   = (timeLeft / TIMER_SEC) * 100;
  const timerColor = timeLeft > 6 ? c.success : timeLeft > 3 ? c.warn : c.danger;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={s.playWrap}>
        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.progressWrap}>
            <View style={[s.progressBar, { backgroundColor: c.barTrack }]}>
              <View style={[s.progressFill, { width: `${(current / questions.length) * 100}%`, backgroundColor: c.accent }]} />
            </View>
            <Text style={[type.caption, { color: c.textMuted, fontWeight: '700' }]}>
              {current + 1} / {questionCount ?? '∞'}
            </Text>
          </View>
          {mode === 'classic' && (
            <View style={[s.scoreChip, { backgroundColor: c.accentTint, borderColor: c.accentBorder }]}>
              <Text style={[type.caption, { color: c.accent, fontWeight: '800' }]}>
                {score.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Timer */}
        {mode === 'classic' && (
          <View style={s.timerWrap}>
            <View style={[s.timerBar, { backgroundColor: c.barTrack }]}>
              <View style={[s.timerFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} />
            </View>
            <Text style={[type.h3, { color: timerColor, minWidth: 24, textAlign: 'right' }]}>{timeLeft}</Text>
          </View>
        )}

        {/* Combo */}
        {combo >= 2 && (
          <Text style={[type.button, {
            alignSelf: 'center', color: c.warn,
            backgroundColor: c.warnTint, borderWidth: 1, borderColor: c.warnBorder,
            borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 5,
          }]}>
            ⚡ {combo}x Combo
          </Text>
        )}

        {/* Question */}
        <View style={[s.questionCard, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
          <Text style={[type.monoLabel, { color: c.textDim }]}>
            {q.questionIsWord ? 'Türkçe karşılığı?' : `${langLabel} karşılığı?`}
          </Text>
          <Text style={[type.h1, { color: c.text, textAlign: 'center', fontSize: 26 }]}>{q.question}</Text>
        </View>

        {/* Choices */}
        <View style={s.choicesGrid}>
          {q.choices.map((choice, i) => {
            const cc       = CHOICE_COLORS[i];
            const isSel    = selected === choice;
            const isCorr   = choice === q.answer;
            const revealed = selected !== null;
            let bg     = cc.light;
            let border = cc.border;
            let opacity = 1;
            if (revealed) {
              if (isCorr)       { bg = cc.base; border = cc.base; }
              else if (isSel)   { bg = 'rgba(239,68,68,0.25)'; border = '#EF4444'; }
              else opacity = 0.3;
            }
            return (
              <TouchableOpacity
                key={choice}
                activeOpacity={0.8}
                style={[s.choiceBtn, { backgroundColor: bg, borderColor: border, opacity }]}
                onPress={() => handleAnswer(choice)}
                disabled={revealed}
              >
                <Text style={[type.h3, { color: cc.base, fontSize: 18 }]}>{SHAPES[i]}</Text>
                <Text style={[type.bodyMd, { flex: 1, color: '#fff' }]}>{choice}</Text>
                {revealed && isCorr  && <Text style={{ fontSize: 18, color: 'white', fontWeight: '900' }}>✓</Text>}
                {revealed && isSel && !isCorr && <Text style={{ fontSize: 18, color: '#EF4444', fontWeight: '900' }}>✗</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  setupCore:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  startBtn:      { width: '100%', borderRadius: radius.xxl, borderWidth: 1, padding: 20, alignItems: 'center', gap: 6, marginTop: 12 },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, paddingBottom: 36, gap: 14 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modeRow:       { flexDirection: 'row', gap: 10 },
  modeBtn:       { flex: 1, borderWidth: 1.5, borderRadius: radius.lg, padding: 14, alignItems: 'center', gap: 4 },
  countRow:      { flexDirection: 'row', gap: 10 },
  countBtn:      { flex: 1, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  sheetStartBtn: { borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  doneContainer: { alignItems: 'center', padding: 32, gap: 16 },
  statsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  statBox:       { borderWidth: 1, borderRadius: radius.xl, padding: 16, alignItems: 'center', minWidth: 80, gap: 4 },
  playWrap:      { flex: 1, padding: spacing.gutter, gap: 12 },
  topbar:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:   { flex: 1, height: 6, borderRadius: 99, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 99 },
  scoreChip:     { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  timerWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerBar:      { flex: 1, height: 10, borderRadius: 99, overflow: 'hidden' },
  timerFill:     { height: '100%', borderRadius: 99 },
  questionCard:  { borderWidth: 1, borderRadius: radius.xxl, padding: 24, alignItems: 'center', gap: 10, minHeight: 120, justifyContent: 'center' },
  choicesGrid:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceBtn:     { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 2, borderRadius: radius.lg, minHeight: 72 },
});
