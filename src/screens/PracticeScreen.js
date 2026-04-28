import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';
import { type, spacing, radius } from '../tokens/verbyte.tokens';
import storage from '../utils/storage';

const PREFS_KEY    = 'verbyte_practice_prefs';
const REVEAL_DELAY = 1400;
const COUNTS       = [10, 20, null];

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
  return str.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Fill mode ────────────────────────────────────────────────────────────────
function FillMode({ sentences, wordKey, count, onDone }) {
  const { c } = useTheme();
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
      const pick  = candidates[Math.floor(Math.random() * candidates.length)];
      const pool2 = shuffle([...new Set(all.flatMap(s2 => (s2[wordKey] ?? '').split(' ').map(w => w.replace(/[.,!?]/g, ''))).filter(w => w.length >= 2 && w.toLowerCase() !== pick.w.toLowerCase()))]);
      const blanked = words.map((w, i) => i === pick.i ? '___' : w).join(' ');
      return { blanked, answer: pick.w, choices: shuffle([pick.w, ...pool2.slice(0, 3)]), tr: s.tr };
    }).filter(Boolean);
  });
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect]   = useState(0);
  const [wrong, setWrong]       = useState(0);
  const ref = useRef(null);

  useEffect(() => () => clearTimeout(ref.current), []);

  function handleAnswer(choice) {
    if (selected !== null) return;
    setSelected(choice);
    const ok = choice === questions[current].answer;
    if (ok) setCorrect(n => n + 1); else setWrong(n => n + 1);
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
        <View style={[s.progressBar, { backgroundColor: c.barTrack }]}>
          <View style={[s.progressFill, { width: `${(current / questions.length) * 100}%`, backgroundColor: c.accent }]} />
        </View>
        <Text style={[type.caption, { color: c.textMuted, fontWeight: '700' }]}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
      </View>
      <View style={[s.questionCard, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
        <Text style={[type.monoLabel, { color: c.textDim }]}>Boşluğu doldur</Text>
        <Text style={[type.h3, { color: c.text, textAlign: 'center', lineHeight: 26 }]}>{q.blanked}</Text>
        <Text style={[type.caption, { color: c.textMuted, textAlign: 'center' }]}>{q.tr}</Text>
      </View>
      <View style={s.choicesGrid}>
        {q.choices.map((choice, i) => {
          const cc       = CHOICE_COLORS[i];
          const revealed = selected !== null;
          const isCorr   = choice === q.answer;
          const isSel    = selected === choice;
          let bg = cc.light, border = cc.border, opacity = 1;
          if (revealed) {
            if (isCorr)     { bg = cc.base; border = cc.base; }
            else if (isSel) { bg = 'rgba(239,68,68,0.25)'; border = '#EF4444'; }
            else opacity = 0.3;
          }
          return (
            <TouchableOpacity key={choice}
              style={[s.choiceBtn, { backgroundColor: bg, borderColor: border, opacity }]}
              onPress={() => handleAnswer(choice)} disabled={revealed} activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16, color: cc.base }}>{SHAPES[i]}</Text>
              <Text style={[type.bodyMd, { flex: 1, color: '#fff' }]}>{choice}</Text>
              {revealed && isCorr  && <Text style={{ fontSize: 16, color: 'white', fontWeight: '900' }}>✓</Text>}
              {revealed && isSel && !isCorr && <Text style={{ fontSize: 16, color: '#EF4444', fontWeight: '900' }}>✗</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Sort mode ────────────────────────────────────────────────────────────────
function SortMode({ sentences, wordKey, count, onDone }) {
  const { c } = useTheme();
  const isInf = count === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences ?? []);
    return shuffle(all).slice(0, isInf ? all.length : count).map(s => {
      const text = s[wordKey] ?? '';
      const words = text.split(' ');
      return { words: shuffle(words), answer: words, tr: s.tr, original: text };
    });
  });
  const [current,   setCurrent]   = useState(0);
  const [placed,    setPlaced]    = useState([]);
  const [available, setAvailable] = useState([]);
  const [phase,     setPhase]     = useState('input');
  const [correct,   setCorrect]   = useState(0);
  const [wrong,     setWrong]     = useState(0);
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
    if (ok) setCorrect(n => n + 1); else setWrong(n => n + 1);
    ref.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) onDone(correct + (ok ? 1 : 0), wrong + (ok ? 0 : 1));
      else setCurrent(next);
    }, REVEAL_DELAY);
  }

  const q = questions[current];
  if (!q) { onDone(correct, wrong); return null; }

  const placedBorder = phase === 'correct' ? c.success : phase === 'wrong' ? c.danger : c.panelBorder;

  return (
    <View style={s.playWrap}>
      <View style={s.topbar}>
        <View style={[s.progressBar, { backgroundColor: c.barTrack }]}>
          <View style={[s.progressFill, { width: `${(current / questions.length) * 100}%`, backgroundColor: c.accent }]} />
        </View>
        <Text style={[type.caption, { color: c.textMuted, fontWeight: '700' }]}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
      </View>
      <View style={[s.questionCard, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
        <Text style={[type.monoLabel, { color: c.textDim }]}>Cümleyi oluştur</Text>
        <Text style={[type.caption, { color: c.textMuted, textAlign: 'center' }]}>{q.tr}</Text>
      </View>
      <View style={[s.sortPlaced, { backgroundColor: c.panelStrong, borderColor: placedBorder }]}>
        {placed.length === 0
          ? <Text style={[type.body, { color: c.textFaint }]}>Kelimelere dokun...</Text>
          : placed.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[s.sortChipPlaced, { backgroundColor: c.accentTint, borderColor: c.accentBorder }]}
              onPress={() => {
                if (phase !== 'input') return;
                setPlaced(p => p.filter(x => x.id !== item.id));
                setAvailable(a => [...a, item]);
              }}
            >
              <Text style={[type.bodyMd, { color: c.accent }]}>{item.w}</Text>
            </TouchableOpacity>
          ))
        }
      </View>
      {phase === 'wrong' && (
        <Text style={[type.caption, { color: c.danger, textAlign: 'center' }]}>
          Doğrusu: {q.original}
        </Text>
      )}
      <View style={s.sortAvailable}>
        {available.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[s.sortChip, { backgroundColor: c.panel, borderColor: c.panelBorder }]}
            onPress={() => {
              if (phase !== 'input') return;
              setAvailable(a => a.filter(x => x.id !== item.id));
              setPlaced(p => [...p, item]);
            }}
          >
            <Text style={[type.bodyMd, { color: c.text }]}>{item.w}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {placed.length === q.words.length && phase === 'input' && (
        <TouchableOpacity style={[s.checkBtn, { backgroundColor: c.primaryBtnBg }]} onPress={check}>
          <Text style={[type.button, { color: c.primaryBtnText, fontSize: 17 }]}>Kontrol Et</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Write mode ───────────────────────────────────────────────────────────────
function WriteMode({ sentences, wordKey, count, onDone }) {
  const { c } = useTheme();
  const isInf = count === null;
  const [questions] = useState(() => {
    const all = sentences.flatMap(s => s.sentences ?? []).filter(s => s.answer);
    return shuffle(all).slice(0, isInf ? all.length : count);
  });
  const [current, setCurrent] = useState(0);
  const [input,   setInput]   = useState('');
  const [phase,   setPhase]   = useState('input');
  const [correct, setCorrect] = useState(0);
  const [wrong,   setWrong]   = useState(0);
  const ref = useRef(null);

  useEffect(() => () => clearTimeout(ref.current), []);

  function check() {
    if (!input.trim()) return;
    const q   = questions[current];
    const d   = editDistance(normalize(input), normalize(q.answer));
    const res = d === 0 ? 'correct' : d <= 2 ? 'close' : 'wrong';
    setPhase(res);
    const ok = res !== 'wrong';
    if (ok) setCorrect(n => n + 1); else setWrong(n => n + 1);
    ref.current = setTimeout(() => {
      const next = current + 1;
      if (next >= questions.length) onDone(correct + (ok ? 1 : 0), wrong + (ok ? 0 : 1));
      else { setCurrent(next); setInput(''); setPhase('input'); }
    }, 1800);
  }

  const q = questions[current];
  if (!q) { onDone(correct, wrong); return null; }

  const phaseMap = {
    correct: { label: '✓ Mükemmel!', color: c.success },
    close:   { label: '~ Çok yakın!', color: c.warn },
    wrong:   { label: '✗ Yanlış',    color: c.danger },
    input:   { label: 'Eksik kelimeyi yaz', color: c.textMuted },
  };
  const cfg = phaseMap[phase];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.playWrap}>
        <View style={s.topbar}>
          <View style={[s.progressBar, { backgroundColor: c.barTrack }]}>
            <View style={[s.progressFill, { width: `${(current / questions.length) * 100}%`, backgroundColor: c.accent }]} />
          </View>
          <Text style={[type.caption, { color: c.textMuted, fontWeight: '700' }]}>{current + 1} / {isInf ? '∞' : questions.length}</Text>
        </View>
        <View style={[s.questionCard, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
          <Text style={[type.monoLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={[type.h3, { color: c.text, textAlign: 'center' }]}>{q[wordKey] ?? ''}</Text>
          {q.tr ? <Text style={[type.caption, { color: c.textMuted }]}>🇹🇷 {q.tr}</Text> : null}
          {phase !== 'input' && (
            <Text style={[type.h3, { color: cfg.color, marginTop: 4 }]}>{q.answer}</Text>
          )}
        </View>
        <View style={s.writeRow}>
          <TextInput
            style={[
              s.writeInput,
              { backgroundColor: c.panelStrong, borderColor: c.panelBorder, color: c.text },
              phase !== 'input' && { opacity: 0.5 },
            ]}
            value={input} onChangeText={setInput} onSubmitEditing={check}
            placeholder="Eksik kelimeyi yaz..." placeholderTextColor={c.textFaint}
            editable={phase === 'input'} autoCorrect={false} autoCapitalize="none"
            returnKeyType="done"
          />
          {phase === 'input' && (
            <TouchableOpacity
              style={[s.writeSubmit, { backgroundColor: c.accent }]}
              onPress={check} disabled={!input.trim()}
            >
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>→</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PracticeScreen({ langConfig }) {
  const { c } = useTheme();
  const sentences = langConfig?.sentenceCategories ?? [];
  const wordKey   = langConfig?.wordKey ?? 'fr';

  const [mode,        setMode]        = useState('fill');
  const [count,       setCount]       = useState(10);
  const [showSheet,   setShowSheet]   = useState(false);
  const [phase,       setPhase]       = useState('setup');
  const [doneCorrect, setDoneCorrect] = useState(0);
  const [doneWrong,   setDoneWrong]   = useState(0);

  useEffect(() => {
    storage.getJSON(PREFS_KEY).then(p => {
      if (!p) return;
      if (p.mode)             setMode(p.mode);
      if (p.count !== undefined) setCount(p.count);
    });
  }, []);

  function startPractice() {
    storage.setJSON(PREFS_KEY, { mode, count });
    setShowSheet(false);
    setPhase('playing');
  }

  function handleDone(correct, wrong) {
    setDoneCorrect(correct);
    setDoneWrong(wrong);
    setPhase('done');
  }

  const modeLabels = { fill: 'Boşluk Doldur', sort: 'Kelime Sırala', write: 'Yaz' };

  // ── Playing ────────────────────────────────────────────────────────────────
  if (phase === 'playing') {
    if (sentences.length === 0) return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={[type.body, { color: c.textMuted, textAlign: 'center' }]}>
            Cümle verisi henüz yüklenmedi.
          </Text>
        </View>
      </SafeAreaView>
    );
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {mode === 'fill'  && <FillMode  key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
        {mode === 'sort'  && <SortMode  key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
        {mode === 'write' && <WriteMode key={mode+count} sentences={sentences} wordKey={wordKey} count={count} onDone={handleDone} />}
      </SafeAreaView>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const total = doneCorrect + doneWrong;
    const acc   = total > 0 ? Math.round((doneCorrect / total) * 100) : 0;
    const accColor = acc >= 70 ? c.success : acc >= 50 ? c.warn : c.danger;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={s.doneContainer}>
          <Text style={{ fontSize: 72 }}>{acc >= 80 ? '🏆' : acc >= 50 ? '🎯' : '💪'}</Text>
          <Text style={[type.h1, { color: c.text }]}>{acc >= 80 ? 'Harika!' : acc >= 50 ? 'İyi iş!' : 'Devam et!'}</Text>
          <View style={s.statsRow}>
            {[[doneCorrect, c.success, 'Doğru'], [doneWrong, c.danger, 'Yanlış'], [`${acc}%`, accColor, 'Doğruluk']].map(([val, color, lbl]) => (
              <View key={lbl} style={[s.statBox, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
                <Text style={[type.h2, { color }]}>{val}</Text>
                <Text style={[type.small, { color: c.textMuted, fontWeight: '600' }]}>{lbl}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[s.sheetStartBtn, { backgroundColor: c.primaryBtnBg, width: '100%' }]}
            onPress={() => setPhase('playing')}
          >
            <Text style={[type.button, { color: c.primaryBtnText, fontSize: 17 }]}>Tekrar Oyna</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 14 }} onPress={() => setPhase('setup')}>
            <Text style={[type.bodyMd, { color: c.textMuted }]}>Mod Seçimine Dön</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={s.setupCore}>
        <Text style={[type.display, { color: c.accent, letterSpacing: -1 }]}>Pratik</Text>
        <Text style={[type.body, { color: c.textMuted, marginTop: -4 }]}>Cümle alıştırmaları</Text>

        <TouchableOpacity
          style={[s.startBtn, { backgroundColor: c.panel, borderColor: c.accentBorder }]}
          onPress={() => setShowSheet(true)}
          activeOpacity={0.85}
        >
          <Text style={[type.caption, { color: c.textMuted }]}>{modeLabels[mode]} · {count ?? '∞'} soru</Text>
          <Text style={[type.h2, { color: c.accent }]}>Başla →</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <Pressable style={s.overlay} onPress={() => setShowSheet(false)} />
        <View style={[s.sheet, { backgroundColor: c.panel, borderTopColor: c.panelBorder }]}>
          <View style={[s.sheetHandle, { backgroundColor: c.hairline }]} />

          <Text style={[type.monoLabel, { color: c.textDim }]}>MOD</Text>
          <View style={s.modeRow}>
            {[['fill','🔤','Boşluk Doldur','Eksik kelimeyi bul'], ['sort','🔀','Sırala','Cümleyi oluştur'], ['write','✏️','Yaz','Kendin yaz']].map(([val, icon, name, desc]) => (
              <TouchableOpacity
                key={val}
                style={[
                  s.modeBtn,
                  { backgroundColor: c.panelStrong, borderColor: c.panelBorder },
                  mode === val && { borderColor: c.accent, backgroundColor: c.accentTint },
                ]}
                onPress={() => setMode(val)}
              >
                <Text style={{ fontSize: 22 }}>{icon}</Text>
                <Text style={[type.row, { color: mode === val ? c.accent : c.text, fontWeight: '700', textAlign: 'center' }]}>{name}</Text>
                <Text style={[type.small, { color: c.textMuted, textAlign: 'center' }]}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[type.monoLabel, { color: c.textDim }]}>SORU SAYISI</Text>
          <View style={s.countRow}>
            {COUNTS.map(cnt => (
              <TouchableOpacity
                key={cnt ?? 'inf'}
                style={[
                  s.countBtn,
                  { backgroundColor: c.panelStrong, borderColor: c.panelBorder },
                  count === cnt && { borderColor: c.accent, backgroundColor: c.accentTint },
                ]}
                onPress={() => setCount(cnt)}
              >
                <Text style={[type.h2, { color: count === cnt ? c.accent : c.text }]}>{cnt ?? '∞'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.sheetStartBtn, { backgroundColor: c.primaryBtnBg }]}
            onPress={startPractice}
            activeOpacity={0.85}
          >
            <Text style={[type.button, { color: c.primaryBtnText, fontSize: 17 }]}>Başla →</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  setupCore:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  startBtn:      { width: '100%', borderRadius: radius.xxl, borderWidth: 1, padding: 20, alignItems: 'center', gap: 6, marginTop: 12 },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, paddingBottom: 36, gap: 14 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modeRow:       { flexDirection: 'row', gap: 8 },
  modeBtn:       { flex: 1, borderWidth: 1.5, borderRadius: radius.lg, padding: 12, alignItems: 'center', gap: 4 },
  countRow:      { flexDirection: 'row', gap: 10 },
  countBtn:      { flex: 1, borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  sheetStartBtn: { borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  doneContainer: { alignItems: 'center', padding: 32, gap: 16 },
  statsRow:      { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  statBox:       { borderWidth: 1, borderRadius: radius.xl, padding: 16, alignItems: 'center', minWidth: 80, gap: 4 },
  playWrap:      { flex: 1, padding: spacing.gutter, gap: 12 },
  topbar:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar:   { flex: 1, height: 6, borderRadius: 99, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 99 },
  questionCard:  { borderWidth: 1, borderRadius: radius.xxl, padding: 20, alignItems: 'center', gap: 10 },
  choicesGrid:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceBtn:     { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 2, borderRadius: radius.lg, minHeight: 64 },
  sortPlaced:    { minHeight: 60, borderRadius: radius.lg, borderWidth: 1.5, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sortChip:      { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  sortChipPlaced:{ borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  sortAvailable: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkBtn:      { borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center' },
  writeRow:      { flexDirection: 'row', gap: 10, alignItems: 'center' },
  writeInput:    { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: 14, fontSize: 16 },
  writeSubmit:   { borderRadius: radius.md, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
