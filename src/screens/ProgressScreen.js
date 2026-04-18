import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, LEVEL_COLORS } from '../utils/colors';
import storage from '../utils/storage';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export default function ProgressScreen({ langConfig }) {
  const wordKey = langConfig?.wordKey ?? 'fr';
  const vocabulary = langConfig?.vocabulary ?? {};

  const [streak, setStreak]     = useState(0);
  const [todayCards, setToday]  = useState(0);
  const [totalWords, setTotal]  = useState(0);
  const [levelStats, setLevels] = useState([]);

  useEffect(() => {
    async function load() {
      const s = await storage.getJSON('verbyte_streak');
      setStreak(s?.count ?? 0);

      const key = `verbyte_daily_${new Date().toISOString().slice(0,10)}`;
      const today = await storage.getJSON(key);
      setToday(today ?? 0);

      const prog = await storage.getJSON(`${wordKey}_progress`) ?? {};
      let total = 0;
      const stats = [];

      for (const level of LEVELS) {
        const cats = Object.entries(vocabulary).filter(([, words]) =>
          words?.[0]?.level === level || words?.[0]?.cefr === level
        );
        const words = cats.flatMap(([, w]) => w);
        const known = words.filter(w => (prog[w[wordKey]]?.reps ?? 0) > 0).length;
        if (words.length > 0) {
          stats.push({ level, known, total: words.length, pct: Math.round((known / words.length) * 100) });
          total += known;
        }
      }
      setTotal(total);
      setLevels(stats);
    }
    load();
  }, [wordKey, vocabulary]);

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>İlerleme</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[['🔥', streak, 'gün serisi'], ['📚', todayCards, 'bugün kart'], ['✨', totalWords, 'toplam']].map(([icon, val, lbl]) => (
            <View key={lbl} style={s.statBox}>
              <Text style={s.statIcon}>{icon}</Text>
              <Text style={s.statVal}>{val}</Text>
              <Text style={s.statLbl}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Level progress */}
        <Text style={s.sectionTitle}>Seviyeler</Text>
        {levelStats.map(({ level, known, total, pct }) => (
          <View key={level} style={s.levelRow}>
            <View style={[s.levelBadge, { backgroundColor: LEVEL_COLORS[level] }]}>
              <Text style={s.levelBadgeText}>{level}</Text>
            </View>
            <View style={s.levelBarWrap}>
              <View style={s.levelBar}>
                <View style={[s.levelFill, { width: `${pct}%`, backgroundColor: LEVEL_COLORS[level] }]} />
              </View>
              <Text style={s.levelCount}>{known}/{total}</Text>
            </View>
            <Text style={s.levelPct}>{pct}%</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page:          { flex: 1, backgroundColor: COLORS.bg },
  scroll:        { padding: 20, gap: 16 },
  title:         { fontSize: 28, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  statsRow:      { flexDirection: 'row', gap: 10 },
  statBox:       { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 },
  statIcon:      { fontSize: 24 },
  statVal:       { fontSize: 24, fontWeight: '900', color: COLORS.text },
  statLbl:       { fontSize: 11, color: COLORS.muted, textAlign: 'center' },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.5 },
  levelRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  levelBadge:    { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  levelBadgeText:{ fontSize: 12, fontWeight: '800', color: 'white' },
  levelBarWrap:  { flex: 1, gap: 4 },
  levelBar:      { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' },
  levelFill:     { height: '100%', borderRadius: 99 },
  levelCount:    { fontSize: 11, color: COLORS.muted },
  levelPct:      { fontSize: 14, fontWeight: '800', color: COLORS.text, minWidth: 36, textAlign: 'right' },
});
