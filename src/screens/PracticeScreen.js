import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/colors';
import storage from '../utils/storage';

const PREFS_KEY   = 'verbyte_practice_prefs';
const REVEAL_DELAY = 1400;
const COUNTS = [10, 20, null];

const CHOICE_COLORS = [
  { base: '#E53E3E', light: 'rgba(229,62,62,0.18)',  border: 'rgba(229,62,62,0.5)'  },
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

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function normalize(str) {
  return str.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Fill mode ────────────────────────────────────────────────
function FillMode({ sentences, wordKey, count, onDone }) {
  const isInf = count === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences ?? []);
    const pool = shuffle(all).slice(0, isInf ? all.length : count);
    return pool.map(s => {
      const text = s[wordKey] ?? '';
      if (!text) return null;
      const words = text.split(' ');
      const candidates = words.map((w, i) => ({ w: w.replace(/[.,!?]/g, ''), i })).filter(x => x.w.length >= 2);
      if (!candidates.length) return null;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const pool2 = shuffle([...new Set(all.flatMap(s2 => (s2[wordKey] ?? '').split(' ').map(w => w.replace(/[.,!?]/g, ''))).filter(w => w.length >= 2 && w.toLowerCase() !== pick.w.toLowerCase()))]);
      const blanked = words.map((w, i) => i === pick.i ? '___' : w).join(' ');
      return { blanked, answer: pick.w, choices: shuffle([pick.w, ...pool2.slice(0, 3)]), tr: s.tr };
    }).filter(Boolean);
  });
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const ref = useRef(null);

  useEffect(() => () => clearTimeout(ref.current), []);

  function handleAnswer(choice) {
    if (selected !== null) return;
    setSelected(choice);
    const ok = choice === questions[current].answer;
    if (ok) setCorrect(c => c + 1); else setWrong(w => w + 1);
    ref.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) onDone(correct + (ok ? 1 : 0), wrong + (ok ? 0 : 1));
      else { setCurrent(next); setSelected(null); }
    }, REVEAL_DELAY);
  }

  const q = questions[current];
  if (!q) { onDone(correct, wrong); return null; }

  return (
    <View style={s.playWrap}>
      <View style={s.topbar}>
        <View style={s.progressBar}><View style={[s.progressFill, { width: `${(current / questions.length) * 100}%` }]} /></View>
        <Text style={s.qnum}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
      </View>
      <View style={s.questionCard}>
        <Text style={s.qLabel}>Boşluğu doldur</Text>
        <Text style={s.fillSentence}>{q.blanked}</Text>
        <Text style={s.fillTr}>{q.tr}</Text>
      </View>
      <View style={s.choicesGrid}>
        {q.choices.map((choice, i) => {
          const c = CHOICE_COLORS[i];
          const revealed = selected !== null;
          const isCorrect = choice === q.answer;
          const isSelected = selected === choice;
          let bg = c.light, border = c.border, opacity = 1;
          if (revealed) {
            if (isCorrect) { bg = c.base; border = c.base; }
            else if (isSelected) { bg = 'rgba(239,68,68,0.25)'; border = '#EF4444'; }
            else opacity = 0.3;
          }
          return (
            <TouchableOpacity key={choice} style={[s.choiceBtn, { backgroundColor: bg, borderColor: border, opacity }]}
              onPress={() => handleAnswer(choice)} disabled={revealed} activeOpacity={0.8}>
              <Text style={[s.choiceShape, { color: c.base }]}>{SHAPES[i]}</Text>
              <Text style={s.choiceText}>{choice}</Text>
              {revealed && isCorrect && <Text style={s.check}>✓</Text>}
              {revealed && isSelected && !isCorrect && <Text style={s.xmark}>✗</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Sort mode ─────────────────────────────────────────────────
function SortMode({ sentences, wordKey, count, onDone }) {
  const isInf = count === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences ?? []);
    return shuffle(all).slice(0, isInf ? all.length : count).map(s => {
      const text = s[wordKey] ?? '';
      const words = text.split(' ');
      return { words: shuffle(words), answer: words, tr: s.tr, original: text };
    });
  });
  const [current, setCurrent] = useState(0);
  const [placed, setPlaced] = useState([]);
  const [available, setAvailable] = useState([]);
  const [phase, setPhase] = useState('input');
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const ref = useRef(null);

  useEffect(() => () => clearTimeout(ref.current), []);
  useEffect(() => {
    setAvailable((questions[current]?.words ?? []).map((w, i) => ({ w, id: i })));
    setPlaced([]); setPhase('input');
  }, [current]);

  function check() {
    const q = questions[current];
    const ok = placed.map(x => x.w).join(' ') === q.original;
    setPhase(ok ? 'correct' : 'wrong');
    if (ok) setCorrect(c => c + 1); else setWrong(w => w + 1);
    ref.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) onDone(correct + (ok ? 1 : 0), wrong + (ok ? 0 : 1));
      else setCurrent(next);
    }, REVEAL_DELAY);
  }

  const q = questions[current];
  if (!q) { onDone(correct, wrong); return null; }

  return (
    <View style={s.playWrap}>
      <View style={s.topbar}>
        <View style={s.progressBar}><View style={[s.progressFill, { width: `${(current / questions.length) * 100}%` }]} /></View>
        <Text style={s.qnum}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
      </View>
      <View style={s.questionCard}>
        <Text style={s.qLabel}>Cümleyi oluştur</Text>
        <Text style={s.fillTr}>{q.tr}</Text>
      </View>
      <View style={[s.sortPlaced, phase === 'correct' && s.sortCorrect, phase === 'wrong' && s.sortWrong]}>
        {placed.length === 0
          ? <Text style={s.sortPlaceholder}>Kelimelere dokun...</Text>
          : placed.map(item => (
            <TouchableOpacity key={item.id} style={s.sortChipPlaced} onPress={() => {
              if (phase !== 'input') return;
              setPlaced(p => p.filter(x => x.id !== item.id));
              setAvailable(a => [...a, item]);
            }}><Text style={s.sortChipText}>{item.w}</Text></TouchableOpacity>
          ))
        }
      </View>
      {phase === 'wrong' && <Text style={s.sortCorrectAnswer}>Doğrusu: {q.original}</Text>}
      <View style={s.sortAvailable}>
        {available.map(item => (
          <TouchableOpacity key={item.id} style={s.sortChip} onPress={() => {
            if (phase !== 'input') return;
            setAvailable(a => a.filter(x => x.id !== item.id));
            setPlaced(p => [...p, item]);
          }}><Text style={s.sortChipText}>{item.w}</Text></TouchableOpacity>
        ))}
      </View>
      {placed.length === q.words.length && phase === 'input' && (
        <TouchableOpacity style={s.checkBtn} onPress={check}><Text style={s.checkBtnText}>Kontrol Et</Text></TouchableOpacity>
      )}
    </View>
  );
}

// ── Write mode ────────────────────────────────────────────────
function WriteMode({ sentences, wordKey, count, onDone }) {
  const isInf = count === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences ?? []).filter(s => s.answer);
    return shuffle(all).slice(0, isInf ? all.length : count);
  });
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('input');
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const ref = useRef(null);

  useEffect(() => () => clearTimeout(ref.current), []);

  function check() {
    if (!input.trim()) return;
    const q = questions[current];
    const d = editDistance(normalize(input), normalize(q.answer));
    const result = d === 0 ? 'correct' : d <= 2 ? 'close' : 'wrong';
    setPhase(result);
    if (result !== 'wrong') setCorrect(c => c + 1); else setWrong(w => w + 1);
    const ok = result !== 'wrong';
    ref.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) onDone(correct + (ok ? 1 : 0), wrong + (ok ? 0 : 1));
      else { setCurrent(next); setInput(''); setPhase('input'); }
    }, 1800);
  }

  const q = questions[current];
  if (!q) { onDone(correct, wrong); return null; }
  const cfg = { correct: { label: '✓ Mükemmel!', color: COLORS.green }, close: { label: '~ Çok yakın!', color: COLORS.yellow }, wrong: { label: '✗ Yanlış', color: COLORS.red }, input: { label: 'Eksik kelimeyi yaz', color: COLORS.muted } }[phase];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.playWrap}>
        <View style={s.topbar}>
          <View style={s.progressBar}><View style={[s.progressFill, { width: `${(current / questions.length) * 100}%` }]} /></View>
          <Text style={s.qnum}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
        </View>
        <View style={s.questionCard}>
          <Text style={[s.qLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={s.fillSentence}>{q[wordKey] ?? ''}</Text>
          {q.tr ? <Text style={s.fillTr}>🇹🇷 {q.tr}</Text> : null}
          {phase !== 'input' && <Text style={[s.writeReveal, { color: cfg.color }]}>{q.answer}</Text>}
        </View>
        <View style={s.writeRow}>
          <TextInput
            style={[s.writeInput, phase !== 'input' && { opacity: 0.5 }]}
            value={input} onChangeText={setInput}
            onSubmitEditing={check}
            placeholder="Eksik kelimeyi yaz..." placeholderTextColor={COLORS.muted}
            editable={phase === 'input'} autoCorrect={false} autoCapitalize="none"
            returnKeyType="done"
          />
          {phase === 'input' && (
            <TouchableOpacity style={s.writeSubmit} onPress={check} disabled={!input.trim()}>
              <Text style={s.writeSubmitText}>→</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function PracticeScreen({ langConfig }) {
  const sentences = langConfig?.sentenceCategories ?? [];
  const wordKey = langConfig?.wordKey ?? 'fr';

  const [mode, setMode] = useState('fill');
  const [count, setCount] = useState(10);
  const [showSheet, setShowSheet] = useState(false);
  const [phase, setPhase] = useState('setup');
  const [doneCorrect, setDoneCorrect] = useState(0);
  const [doneWrong, setDoneWrong] = useState(0);

  useEffect(() => {
    storage.getJSON(PREFS_KEY).then(p => {
      if (!p) return;
      if (p.mode) setMode(p.mode);
      if (p.count !== undefined) setCount(p.count);
    });
  }, []);

  function startPractice() {
    storage.setJSON(PREFS_KEY, { mode, count });
    setShowSheet(false);
    setPhase('playing');
  }

  function handleDone(c, w) { setDoneCorrect(c); setDoneWrong(w); setPhase('done'); }

  const modeLabels = { fill: 'Boşluk Doldur', sort: 'Kelime Sırala', write: 'Yaz' };

  if (phase === 'playing') {
    if (sentences.length === 0) return (
      <SafeAreaView style={s.page}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.muted, fontSize: 15 }}>Cümle verisi yüklenmedi.</Text>
        </View>
      </SafeAreaView>
    );
    return (
      <SafeAreaView style={s.page}>
        {mode === 'fill'  && <FillMode  key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
        {mode === 'sort'  && <SortMode  key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
        {mode === 'write' && <WriteMode key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    const total = doneCorrect + doneWrong;
    const acc = total > 0 ? Math.round((doneCorrect / total) * 100) : 0;
    return (
      <SafeAreaView style={s.page}>
        <ScrollView contentContainerStyle={s.doneContainer}>
          <Text style={s.doneEmoji}>{acc >= 80 ? '🏆' : acc >= 50 ? '🎯' : '💪'}</Text>
          <Text style={s.doneTitle}>{acc >= 80 ? 'Harika!' : acc >= 50 ? 'İyi iş!' : 'Devam et!'}</Text>
          <View style={s.statsRow}>
            {[[doneCorrect, COLORS.green, 'Doğru'], [doneWrong, COLORS.red, 'Yanlış'], [`${acc}%`, acc >= 70 ? COLORS.green : COLORS.yellow, 'Doğruluk']].map(([val, color, lbl]) => (
              <View key={lbl} style={s.statBox}><Text style={[s.statVal, { color }]}>{val}</Text><Text style={s.statLbl}>{lbl}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={s.startBtn} onPress={() => setPhase('playing')}><Text style={s.startBtnCta}>Tekrar Oyna</Text></TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => setPhase('setup')}><Text style={s.secondaryBtnText}>Mod Seçimine Dön</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.page}>
      <View style={s.setupCore}>
        <Text style={s.setupTitle}>Pratik</Text>
        <Text style={s.setupSub}>Cümle alıştırmaları</Text>
        <TouchableOpacity style={s.startBtn} onPress={() => setShowSheet(true)} activeOpacity={0.85}>
          <Text style={s.startBtnLabel}>{modeLabels[mode]} · {count ?? '∞'} soru</Text>
          <Text style={s.startBtnCta}>Başla →</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <Pressable style={s.overlay} onPress={() => setShowSheet(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sectionLabel}>MOD</Text>
          <View style={s.modeRow}>
            {[['fill','🔤','Boşluk Doldur','Eksik kelimeyi bul'], ['sort','🔀','Kelime Sırala','Cümleyi oluştur'], ['write','✏️','Yaz','Kendin yaz']].map(([val, icon, name, desc]) => (
              <TouchableOpacity key={val} style={[s.modeBtn, mode === val && s.modeBtnActive]} onPress={() => setMode(val)}>
                <Text style={s.modeIcon}>{icon}</Text>
                <Text style={[s.modeName, mode === val && s.modeNameActive]}>{name}</Text>
                <Text style={s.modeDesc}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.sectionLabel}>SORU SAYISI</Text>
          <View style={s.countRow}>
            {COUNTS.map(c => (
              <TouchableOpacity key={c ?? 'inf'} style={[s.countBtn, count === c && s.countBtnActive]} onPress={() => setCount(c)}>
                <Text style={[s.countBtnText, count === c && s.countBtnTextActive]}>{c ?? '∞'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.sheetStartBtn} onPress={startPractice} activeOpacity={0.85}>
            <Text style={s.sheetStartBtnText}>Başla →</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:            { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: COLORS.borderStrong, padding: 20, paddingBottom: 32, gap: 14 },
  sheetHandle:      { width: 36, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1.5 },
  modeRow:          { flexDirection: 'row', gap: 8 },
  modeBtn:          { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4 },
  modeBtnActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.surface3 },
  modeIcon:         { fontSize: 22 },
  modeName:         { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  modeNameActive:   { color: COLORS.primary },
  modeDesc:         { fontSize: 10, color: COLORS.muted, textAlign: 'center' },
  countRow:         { flexDirection: 'row', gap: 10 },
  countBtn:         { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  countBtnActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.surface3 },
  countBtnText:     { fontSize: 20, fontWeight: '800', color: COLORS.text },
  countBtnTextActive: { color: COLORS.primary },
  sheetStartBtn:    { backgroundColor: '#2A1B3D', borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderStrong, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  sheetStartBtnText:{ fontSize: 17, fontWeight: '800', color: COLORS.primary },
  secondaryBtn:     { paddingVertical: 14, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, color: COLORS.muted },
  doneContainer:    { alignItems: 'center', padding: 32, gap: 16 },
  doneEmoji:        { fontSize: 72 },
  doneTitle:        { fontSize: 30, fontWeight: '800', color: COLORS.text },
  statsRow:         { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  statBox:          { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, alignItems: 'center', minWidth: 80, gap: 4 },
  statVal:          { fontSize: 26, fontWeight: '800' },
  statLbl:          { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  playWrap:         { flex: 1, padding: 16, gap: 12 },
  topbar:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:      { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: COLORS.primary, borderRadius: 99 },
  qnum:             { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  questionCard:     { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 22, padding: 20, alignItems: 'center', gap: 10 },
  qLabel:           { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1 },
  fillSentence:     { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', lineHeight: 26 },
  fillTr:           { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  writeReveal:      { fontSize: 20, fontWeight: '800', marginTop: 4 },
  choicesGrid:      { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceBtn:        { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 2, borderRadius: 16, minHeight: 64 },
  choiceShape:      { fontSize: 16 },
  choiceText:       { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  check:            { fontSize: 16, color: 'white', fontWeight: '900' },
  xmark:            { fontSize: 16, color: COLORS.red, fontWeight: '900' },
  sortPlaced:       { minHeight: 60, backgroundColor: COLORS.surface2, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sortCorrect:      { borderColor: COLORS.green },
  sortWrong:        { borderColor: COLORS.red },
  sortPlaceholder:  { color: COLORS.muted, fontSize: 14 },
  sortChip:         { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  sortChipPlaced:   { backgroundColor: COLORS.surface3, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  sortChipText:     { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  sortCorrectAnswer:{ color: COLORS.red, fontSize: 13, textAlign: 'center' },
  sortAvailable:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkBtn:         { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  checkBtnText:     { color: 'white', fontSize: 17, fontWeight: '800' },
  writeRow:         { flexDirection: 'row', gap: 10, alignItems: 'center' },
  writeInput:       { flex: 1, backgroundColor: COLORS.surface2, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, padding: 14, color: COLORS.text, fontSize: 16 },
  writeSubmit:      { backgroundColor: COLORS.primary, borderRadius: 14, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  writeSubmitText:  { color: 'white', fontSize: 20, fontWeight: '800' },
});
