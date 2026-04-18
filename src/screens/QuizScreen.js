import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/colors';
import storage from '../utils/storage';

const TIMER_SEC = 10;
const REVEAL_DELAY = 1400;
const PREFS_KEY = 'verbyte_quiz_prefs';
const QUESTION_COUNTS = [10, 20, null];

const CHOICE_COLORS = [
  { base: '#E53E3E', light: 'rgba(229,62,62,0.18)', border: 'rgba(229,62,62,0.5)' },
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
  const allWords = Object.entries(vocabulary || {}).flatMap(([, words]) =>
    words.map(w => ({ ...w }))
  );
  const pool = shuffle(allWords).slice(0, count || 100);

  return pool.map(word => {
    if (direction === 'word-tr') {
      const correct = word.tr;
      const wrongs = shuffle(allWords.filter(w => w.tr !== correct))
        .slice(0, 3).map(w => w.tr);
      return { question: word[wordKey], answer: correct, choices: shuffle([correct, ...wrongs]), questionIsWord: true };
    } else {
      const correct = word[wordKey];
      const wrongs = shuffle(allWords.filter(w => w[wordKey] !== correct))
        .slice(0, 3).map(w => w[wordKey]);
      return { question: word.tr, answer: correct, choices: shuffle([correct, ...wrongs]), questionIsWord: false };
    }
  });
}

export default function QuizScreen({ langConfig }) {
  const vocabulary = langConfig?.vocabulary ?? {};
  const wordKey = langConfig?.wordKey ?? 'fr';
  const langLabel = wordKey.toUpperCase();

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('classic');
  const [direction, setDirection] = useState('tr-word');
  const [questionCount, setQuestionCount] = useState(10);
  const [showSheet, setShowSheet] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SEC);
  const timerRef = useRef(null);
  const revealRef = useRef(null);

  // Prefs yükle
  useEffect(() => {
    storage.getJSON(PREFS_KEY).then(p => {
      if (!p) return;
      if (p.mode) setMode(p.mode);
      if (p.direction) setDirection(p.direction);
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

  // Timer
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

    let newCombo = combo;
    let newScore = score;
    if (isCorrect) {
      newCombo = combo + 1;
      const multiplier = Math.min(3, 1 + (newCombo - 1) * 0.5);
      const speedBonus = mode === 'classic' ? Math.round((timeLeft / TIMER_SEC) * 100) : 0;
      newScore = score + Math.round((100 + speedBonus) * multiplier);
      setCorrect(c => c + 1);
    } else {
      newCombo = 0;
      setWrong(w => w + 1);
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

  // ── Setup ──────────────────────────────────────────────────────
  if (phase === 'setup') {
    const modeLabel = mode === 'classic' ? 'Classic' : 'Zen';
    const dirLabel = direction === 'tr-word' ? `TR → ${langLabel}` : `${langLabel} → TR`;
    const countLabel = questionCount ?? '∞';

    return (
      <SafeAreaView style={s.page}>
        <View style={s.setupCore}>
          <Text style={s.setupTitle}>Quiz</Text>
          <Text style={s.setupSub}>Kelimeleri test et</Text>

          <TouchableOpacity style={s.startBtn} onPress={() => setShowSheet(true)} activeOpacity={0.85}>
            <Text style={s.startBtnLabel}>{modeLabel} · {countLabel} soru · {dirLabel}</Text>
            <Text style={s.startBtnCta}>Başla →</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet */}
        <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
          <Pressable style={s.overlay} onPress={() => setShowSheet(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />

            <Text style={s.sectionLabel}>MOD</Text>
            <View style={s.modeRow}>
              {[['classic', '⏱', 'Classic', '10 sn, hız bonusu'], ['zen', '🧘', 'Zen', 'Süresiz']].map(([val, icon, name, desc]) => (
                <TouchableOpacity key={val} style={[s.modeBtn, mode === val && s.modeBtnActive]} onPress={() => setMode(val)}>
                  <Text style={s.modeIcon}>{icon}</Text>
                  <Text style={[s.modeName, mode === val && s.modeNameActive]}>{name}</Text>
                  <Text style={s.modeDesc}>{desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>YÖN</Text>
            <View style={s.modeRow}>
              {[['tr-word', `TR → ${langLabel}`], ['word-tr', `${langLabel} → TR`]].map(([val, label]) => (
                <TouchableOpacity key={val} style={[s.modeBtn, direction === val && s.modeBtnActive]} onPress={() => setDirection(val)}>
                  <Text style={[s.modeName, direction === val && s.modeNameActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>SORU SAYISI</Text>
            <View style={s.countRow}>
              {QUESTION_COUNTS.map(c => (
                <TouchableOpacity key={c ?? 'inf'} style={[s.countBtn, questionCount === c && s.countBtnActive]} onPress={() => setQuestionCount(c)}>
                  <Text style={[s.countBtnText, questionCount === c && s.countBtnTextActive]}>{c ?? '∞'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.sheetStartBtn} onPress={startQuiz} activeOpacity={0.85}>
              <Text style={s.sheetStartBtnText}>Başla →</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Done ──────────────────────────────────────────────────────
  if (phase === 'done') {
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const grade = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '🎯' : accuracy >= 50 ? '💪' : '📚';
    const msg = accuracy >= 90 ? 'Mükemmel!' : accuracy >= 70 ? 'Harika!' : accuracy >= 50 ? 'İyi iş!' : 'Devam et!';
    return (
      <SafeAreaView style={s.page}>
        <ScrollView contentContainerStyle={s.doneContainer}>
          <Text style={s.doneEmoji}>{grade}</Text>
          <Text style={s.doneTitle}>{msg}</Text>
          {mode === 'classic' && <Text style={s.doneScore}>{score.toLocaleString()} puan</Text>}
          <View style={s.statsRow}>
            {[
              [correct, COLORS.green, 'Doğru'],
              [wrong, COLORS.red, 'Yanlış'],
              [`${accuracy}%`, accuracy >= 70 ? COLORS.green : COLORS.yellow, 'Doğruluk'],
              [`${maxCombo}x`, COLORS.text, 'Max Combo'],
            ].map(([val, color, lbl]) => (
              <View key={lbl} style={s.statBox}>
                <Text style={[s.statVal, { color }]}>{val}</Text>
                <Text style={s.statLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.sheetStartBtn} onPress={startQuiz}><Text style={s.sheetStartBtnText}>Tekrar Oyna</Text></TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => setPhase('setup')}><Text style={s.secondaryBtnText}>Ayarları Değiştir</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Playing ───────────────────────────────────────────────────
  const q = questions[current];
  if (!q) return null;
  const timerPct = (timeLeft / TIMER_SEC) * 100;
  const timerColor = timeLeft > 6 ? COLORS.green : timeLeft > 3 ? COLORS.yellow : COLORS.red;

  return (
    <SafeAreaView style={s.page}>
      <View style={s.playWrap}>
        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.progressWrap}>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${(current / questions.length) * 100}%` }]} />
            </View>
            <Text style={s.qnum}>{current + 1} / {questionCount ?? '∞'}</Text>
          </View>
          {mode === 'classic' && (
            <View style={s.scoreChip}>
              <Text style={s.scoreChipText}>{score.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Timer */}
        {mode === 'classic' && (
          <View style={s.timerWrap}>
            <View style={s.timerBar}>
              <View style={[s.timerFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} />
            </View>
            <Text style={[s.timerNum, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        )}

        {/* Combo */}
        {combo >= 2 && <Text style={s.comboBadge}>⚡ {combo}x Combo</Text>}

        {/* Question */}
        <View style={s.questionCard}>
          <Text style={s.questionLabel}>{q.questionIsWord ? 'Türkçe karşılığı?' : `${langLabel} karşılığı?`}</Text>
          <Text style={s.questionText}>{q.question}</Text>
        </View>

        {/* Choices */}
        <View style={s.choicesGrid}>
          {q.choices.map((choice, i) => {
            const c = CHOICE_COLORS[i];
            const isSelected = selected === choice;
            const isCorrect = choice === q.answer;
            const revealed = selected !== null;
            let bg = c.light, border = c.border, opacity = 1;
            if (revealed) {
              if (isCorrect) { bg = c.base; border = c.base; }
              else if (isSelected) { bg = 'rgba(239,68,68,0.25)'; border = '#EF4444'; }
              else opacity = 0.3;
            }
            return (
              <TouchableOpacity
                key={choice} activeOpacity={0.8}
                style={[s.choiceBtn, { backgroundColor: bg, borderColor: border, opacity }]}
                onPress={() => handleAnswer(choice)} disabled={revealed}
              >
                <Text style={[s.choiceShape, { color: c.base }]}>{SHAPES[i]}</Text>
                <Text style={s.choiceText}>{choice}</Text>
                {revealed && isCorrect && <Text style={s.checkMark}>✓</Text>}
                {revealed && isSelected && !isCorrect && <Text style={s.xMark}>✗</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page:             { flex: 1, backgroundColor: COLORS.bg },
  setupCore:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  setupTitle:       { fontSize: 34, fontWeight: '900', color: COLORS.primary, letterSpacing: -1 },
  setupSub:         { fontSize: 15, color: COLORS.muted, marginTop: -4 },
  startBtn:         { width: '100%', backgroundColor: '#2A1B3D', borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderStrong, padding: 20, alignItems: 'center', gap: 6, marginTop: 12 },
  startBtnLabel:    { fontSize: 13, color: COLORS.muted },
  startBtnCta:      { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  // Sheet
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:            { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: COLORS.borderStrong, padding: 20, paddingBottom: 32, gap: 14 },
  sheetHandle:      { width: 36, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5 },
  modeRow:          { flexDirection: 'row', gap: 10 },
  modeBtn:          { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  modeBtnActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.surface3 },
  modeIcon:         { fontSize: 24 },
  modeName:         { fontSize: 15, fontWeight: '700', color: COLORS.text },
  modeNameActive:   { color: COLORS.primary },
  modeDesc:         { fontSize: 11, color: COLORS.muted, textAlign: 'center' },
  countRow:         { flexDirection: 'row', gap: 10 },
  countBtn:         { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  countBtnActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.surface3 },
  countBtnText:     { fontSize: 20, fontWeight: '800', color: COLORS.text },
  countBtnTextActive: { color: COLORS.primary },
  sheetStartBtn:    { backgroundColor: '#2A1B3D', borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderStrong, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  sheetStartBtnText:{ fontSize: 17, fontWeight: '800', color: COLORS.primary },
  secondaryBtn:     { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, color: COLORS.muted },

  // Done
  doneContainer:    { alignItems: 'center', padding: 32, gap: 16 },
  doneEmoji:        { fontSize: 72 },
  doneTitle:        { fontSize: 30, fontWeight: '800', color: COLORS.text },
  doneScore:        { fontSize: 42, fontWeight: '900', color: COLORS.primary },
  statsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  statBox:          { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, alignItems: 'center', minWidth: 80, gap: 4 },
  statVal:          { fontSize: 26, fontWeight: '800' },
  statLbl:          { fontSize: 11, color: COLORS.muted, fontWeight: '600' },

  // Playing
  playWrap:         { flex: 1, padding: 16, gap: 12 },
  topbar:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:      { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: COLORS.primary, borderRadius: 99 },
  qnum:             { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  scoreChip:        { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  scoreChipText:    { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  timerWrap:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerBar:         { flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' },
  timerFill:        { height: '100%', borderRadius: 99 },
  timerNum:         { fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'right' },
  comboBadge:       { alignSelf: 'center', fontSize: 14, fontWeight: '800', color: COLORS.yellow, backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 5 },
  questionCard:     { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 22, padding: 24, alignItems: 'center', gap: 10, minHeight: 120, justifyContent: 'center' },
  questionLabel:    { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  questionText:     { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  choicesGrid:      { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceBtn:        { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 2, borderRadius: 16, minHeight: 72 },
  choiceShape:      { fontSize: 18 },
  choiceText:       { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  checkMark:        { fontSize: 18, color: 'white', fontWeight: '900' },
  xMark:            { fontSize: 18, color: COLORS.red, fontWeight: '900' },
});
