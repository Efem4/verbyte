import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';
import { type, spacing, radius } from '../tokens/verbyte.tokens';
import { LEVEL_COLORS } from '../config/languageRegistry';
import storage from '../utils/storage';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export default function ProgressScreen({ langConfig }) {
  const { c } = useTheme();
  const wordKey    = langConfig?.wordKey ?? 'fr';
  const vocabulary = langConfig?.vocabulary ?? {};

  const [streak,     setStreak]  = useState(0);
  const [todayCards, setToday]   = useState(0);
  const [totalWords, setTotal]   = useState(0);
  const [levelStats, setLevels]  = useState([]);

  useEffect(() => {
    async function load() {
      const str = await storage.getJSON('verbyte_streak');
      setStreak(str?.count ?? 0);

      const key   = `verbyte_daily_${new Date().toISOString().slice(0, 10)}`;
      const today = await storage.getJSON(key);
      setToday(today ?? 0);

      const prog  = await storage.getJSON(`${wordKey}_progress`) ?? {};
      let total   = 0;
      const stats = [];

      for (const level of LEVELS) {
        const cats  = Object.entries(vocabulary).filter(([, words]) =>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[s.scroll, { gap: spacing.sectionGap }]}>
        {/* Başlık */}
        <Text style={[type.h1, { color: c.text, marginBottom: 4 }]}>İlerleme</Text>

        {/* Özet istatistikler */}
        <View style={s.statsRow}>
          {[
            ['🔥', streak,     'gün serisi'],
            ['📚', todayCards, 'bugün kart'],
            ['✨', totalWords, 'toplam'],
          ].map(([icon, val, lbl]) => (
            <View key={lbl} style={[s.statBox, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
              <Text style={{ fontSize: 24 }}>{icon}</Text>
              <Text style={[type.h2, { color: c.text }]}>{val}</Text>
              <Text style={[type.small, { color: c.textMuted, textAlign: 'center' }]}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Level ilerleme çubukları */}
        <Text style={[type.monoLabel, { color: c.textDim }]}>SEVİYELER</Text>

        {levelStats.length === 0 && (
          <View style={[s.emptyBox, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
            <Text style={[type.body, { color: c.textMuted, textAlign: 'center' }]}>
              Henüz kart çalışılmadı.{'\n'}Kartlar sekmesinden başlayabilirsin.
            </Text>
          </View>
        )}

        {levelStats.map(({ level, known, total, pct }) => (
          <View key={level} style={[s.levelRow, { backgroundColor: c.panel, borderColor: c.panelBorder }]}>
            <View style={[s.levelBadge, { backgroundColor: LEVEL_COLORS[level] }]}>
              <Text style={[type.mono, { color: '#fff', fontWeight: '800' }]}>{level}</Text>
            </View>
            <View style={s.levelBarWrap}>
              <View style={[s.levelBar, { backgroundColor: c.barTrack }]}>
                <View style={[s.levelFill, { width: `${pct}%`, backgroundColor: LEVEL_COLORS[level] }]} />
              </View>
              <Text style={[type.small, { color: c.textMuted }]}>{known}/{total} kelime</Text>
            </View>
            <Text style={[type.bodyMd, { color: c.text, minWidth: 40, textAlign: 'right' }]}>
              {pct}%
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll:       { padding: spacing.gutter, paddingTop: spacing.xxxl },
  statsRow:     { flexDirection: 'row', gap: spacing.blockGap },
  statBox:      { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: 4 },
  emptyBox:     { borderWidth: 1, borderRadius: radius.lg, padding: 24, alignItems: 'center' },
  levelRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1 },
  levelBadge:   { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  levelBarWrap: { flex: 1, gap: 4 },
  levelBar:     { height: 6, borderRadius: 99, overflow: 'hidden' },
  levelFill:    { height: '100%', borderRadius: 99 },
});
