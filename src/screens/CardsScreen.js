import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../utils/ThemeContext';
import { type, spacing, radius, shadows, colors as TOKEN_COLORS } from '../tokens/verbyte.tokens';
import { LEVEL_COLORS } from '../config/languageRegistry';
import { buildSmartQueue, updateEntry, getDueCount, getMasteredCount } from '../utils/srs';
import storage from '../utils/storage';
import { getAudioUrl } from '../utils/audioConfig';

// ─── Sabitler ────────────────────────────────────────────────────────────────
const LEVELS    = ['A1', 'A2', 'B1', 'B2', 'C1'];
const NEW_LIMIT = 5;
const { width } = Dimensions.get('window');

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// ─── Flashcard ────────────────────────────────────────────────────────────────
function Flashcard({ word, onKnow, onSkip, combo, langCode, wordKey }) {
  const { c } = useTheme();
  const [flipped, setFlipped] = useState(false);
  const flipAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setFlipped(false);
    flipAnim.setValue(0);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [word?.id]);

  useEffect(() => {
    if (!word?.id) return;
    let sound;
    const url = getAudioUrl(langCode, word.id);
    Audio.Sound.createAsync({ uri: url })
      .then(({ sound: s }) => {
        sound = s;
        s.playAsync().catch(() => {});
      })
      .catch(() => {});
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [word?.id]);

  const playSound = () => {
    if (!word?.id) return;
    Audio.Sound.createAsync({ uri: getAudioUrl(langCode, word.id) })
      .then(({ sound: s }) => {
        s.playAsync().catch(() => {});
        s.setOnPlaybackStatusUpdate(st => {
          if (st.didJustFinish) s.unloadAsync().catch(() => {});
        });
      })
      .catch(() => {});
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const handleFlip = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      friction: 8, tension: 10, useNativeDriver: true,
    }).start();
    setFlipped(f => !f);
  };

  const handleKnow = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.06, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0,    useNativeDriver: true }),
    ]).start(() => onKnow());
  };

  const handleSkip = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0,    useNativeDriver: true }),
    ]).start(() => onSkip());
  };

  if (!word) return null;

  return (
    <View style={fc.wrapper}>
      {combo > 1 && (
        <View style={[fc.comboBadge, { backgroundColor: c.warnTint, borderColor: c.warnBorder }]}>
          <Text style={[fc.comboText, { color: c.warn }]}>🔥 {combo} combo</Text>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.9} onPress={handleFlip}>
        <Animated.View style={[fc.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Ön yüz */}
          <Animated.View
            style={[
              fc.face,
              { backgroundColor: c.panel, borderColor: c.panelBorder, ...shadows.card },
              { transform: [{ rotateY: frontRotate }] },
            ]}
            pointerEvents={flipped ? 'none' : 'auto'}
          >
            <Text style={[type.monoLabel, { color: c.textDim, position: 'absolute', top: 16, left: 20 }]}>
              {capitalize(word.cat)}
            </Text>
            <Text style={[type.word, { color: c.text, textAlign: 'center' }]}>
              {word[wordKey]}
            </Text>
            <Text style={[type.caption, { color: c.textFaint, position: 'absolute', bottom: 16 }]}>
              Çevirmek için dokun
            </Text>
            <TouchableOpacity
              style={fc.soundBtn}
              onPress={e => { e.stopPropagation?.(); playSound(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 18 }}>🔊</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Arka yüz */}
          <Animated.View
            style={[
              fc.face,
              { backgroundColor: c.panel, borderColor: c.accentBorder, ...shadows.card },
              { transform: [{ rotateY: backRotate }] },
            ]}
            pointerEvents={flipped ? 'auto' : 'none'}
          >
            <Text style={[type.monoLabel, { color: c.textDim, position: 'absolute', top: 16, left: 20 }]}>
              {capitalize(word.cat)}
            </Text>
            <Text style={[type.h1, { color: c.accent, textAlign: 'center', marginBottom: 8 }]}>
              {word.tr}
            </Text>
            {!!word.example && (
              <Text style={[type.body, { color: c.textMuted, textAlign: 'center', fontStyle: 'italic', marginTop: 8, lineHeight: 20 }]}>
                "{word.example}"
              </Text>
            )}
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      <View style={fc.btnRow}>
        <TouchableOpacity
          style={[fc.btn, { backgroundColor: c.dangerTint, borderColor: c.dangerBorder }]}
          onPress={handleSkip}
        >
          <Text style={{ fontSize: 22, marginBottom: 2 }}>✕</Text>
          <Text style={[type.small, { color: c.textMuted, fontWeight: '600' }]}>Bilmiyorum</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[fc.btn, { backgroundColor: c.successTint, borderColor: c.successBorder }]}
          onPress={handleKnow}
        >
          <Text style={{ fontSize: 22, marginBottom: 2 }}>✓</Text>
          <Text style={[type.small, { color: c.textMuted, fontWeight: '600' }]}>Bildim</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
  },
  comboBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
  },
  comboText: {
    ...type.button,
  },
  card: {
    width: width - spacing.gutter * 2,
    height: 260,
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.r3xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backfaceVisibility: 'hidden',
    borderWidth: 1,
  },
  soundBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    width: width - spacing.gutter * 2,
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function CardsScreen({ langConfig }) {
  const { c } = useTheme();
  const [phase, setPhase]             = useState('browse');
  const [activeLevel, setActiveLevel] = useState('A1');
  const [progress, setProgress]       = useState({});
  const [activeCat, setActiveCat]     = useState(null);
  const [queue, setQueue]             = useState([]);
  const [queuePos, setQueuePos]       = useState(0);
  const [knowCount, setKnowCount]     = useState(0);
  const [skipCount, setSkipCount]     = useState(0);
  const [combo, setCombo]             = useState(0);

  useEffect(() => {
    if (!langConfig?.progressKey) return;
    storage.getJSON(langConfig.progressKey, {}).then(setProgress);
  }, [langConfig?.progressKey]);

  const saveProgress = useCallback(async (newProg) => {
    setProgress(newProg);
    await storage.setJSON(langConfig.progressKey, newProg);
  }, [langConfig?.progressKey]);

  const startCategory = useCallback((catId) => {
    const words = langConfig?.vocabulary?.[catId] ?? [];
    if (!words.length) return;
    const q = buildSmartQueue(words, langConfig.wordKey, progress[catId] ?? {}, NEW_LIMIT);
    setActiveCat(catId);
    setQueue(q);
    setQueuePos(0);
    setKnowCount(0);
    setSkipCount(0);
    setCombo(0);
    setPhase('studying');
  }, [langConfig, progress]);

  const vocabulary   = langConfig?.vocabulary ?? {};
  const currentWords = activeCat ? (vocabulary[activeCat] ?? []) : [];
  const currentWord  = queue.length > 0 ? currentWords[queue[queuePos]] : null;

  const advance = useCallback((currentQueue) => {
    setQueuePos(pos => {
      const next = pos + 1;
      if (next >= currentQueue.length) { setPhase('done'); return pos; }
      return next;
    });
  }, []);

  const handleKnow = useCallback(async () => {
    if (!currentWord || !activeCat) return;
    const wk = langConfig?.wordKey ?? 'id';
    const catProg = progress[activeCat] ?? {};
    const newProg = { ...progress, [activeCat]: { ...catProg, [currentWord[wk]]: updateEntry(catProg[currentWord[wk]], true) } };
    await saveProgress(newProg);
    setKnowCount(c => c + 1);
    setCombo(c => c + 1);
    advance(queue);
  }, [currentWord, activeCat, progress, saveProgress, queue, advance, langConfig]);

  const handleSkip = useCallback(async () => {
    if (!currentWord || !activeCat) return;
    const wk = langConfig?.wordKey ?? 'id';
    const catProg = progress[activeCat] ?? {};
    const newProg = { ...progress, [activeCat]: { ...catProg, [currentWord[wk]]: updateEntry(catProg[currentWord[wk]], false) } };
    await saveProgress(newProg);
    setSkipCount(c => c + 1);
    setCombo(0);
    advance(queue);
  }, [currentWord, activeCat, progress, saveProgress, queue, advance, langConfig]);

  const getCatStats = useCallback((catId, words) => {
    const catProg = progress[catId] ?? {};
    return {
      total: words.length,
      known: getMasteredCount(catProg),
      due:   getDueCount(words, langConfig?.wordKey ?? 'id', catProg),
    };
  }, [progress, langConfig?.wordKey]);

  if (!langConfig?.vocabulary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[type.body, { color: c.textMuted }]}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── BROWSE ───────────────────────────────────────────────────────────────────
  if (phase === 'browse') {
    const levelCatIds = (langConfig.categories ?? [])
      .filter(cat => cat.level === activeLevel || !cat.level)
      .map(cat => cat.id);

    const levelCats = levelCatIds.length > 0
      ? Object.fromEntries(levelCatIds.filter(id => vocabulary[id]).map(id => [id, vocabulary[id]]))
      : vocabulary;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: c.hairline }]}>
          <View>
            <Text style={[type.h1, { color: c.text }]}>Kartlar</Text>
            <Text style={[type.caption, { color: c.textMuted, marginTop: 2 }]}>
              {langConfig.languageLabel} kelime çalış
            </Text>
          </View>
        </View>

        {/* Level pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.pillRow, { gap: spacing.sm }]}
        >
          {LEVELS.map(lvl => {
            const isActive   = lvl === activeLevel;
            const isUnlocked = langConfig.loadedLevels?.has(lvl) ?? lvl === 'A1';
            const lvlColor   = (langConfig.levelColors ?? LEVEL_COLORS)[lvl];
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  s.pill,
                  { backgroundColor: c.panel, borderColor: c.panelBorder },
                  isActive   && { backgroundColor: lvlColor, borderColor: lvlColor },
                  !isUnlocked && { opacity: 0.4 },
                ]}
                onPress={() => isUnlocked && setActiveLevel(lvl)}
                activeOpacity={isUnlocked ? 0.7 : 1}
              >
                <Text style={[type.mono, { color: isActive ? '#1a0a2e' : c.textMuted, fontWeight: '700' }]}>
                  {lvl}
                </Text>
                {!isUnlocked && <Text style={{ fontSize: 10 }}>🔒</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Kategori listesi */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.catListContent, { gap: spacing.blockGap }]}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(levelCats).map(([catId, words]) => {
            const { total, known, due } = getCatStats(catId, words);
            const pct     = total > 0 ? known / total : 0;
            const catMeta = (langConfig.categories ?? []).find(cat => cat.id === catId);
            const label   = catMeta
              ? `${catMeta.emoji ?? ''} ${catMeta.label ?? capitalize(catId)}`.trim()
              : capitalize(catId);
            const lvlColor = (langConfig.levelColors ?? LEVEL_COLORS)[activeLevel];

            return (
              <TouchableOpacity
                key={catId}
                style={[s.catCard, { backgroundColor: c.panel, borderColor: c.panelBorder }]}
                onPress={() => startCategory(catId)}
                activeOpacity={0.75}
              >
                <View style={s.catCardTop}>
                  <Text style={[type.bodyMd, { color: c.text, flex: 1 }]}>{label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {due > 0 && (
                      <View style={[s.dueBadge, { backgroundColor: c.accentTint, borderColor: c.accentBorder }]}>
                        <Text style={[type.small, { color: c.accent, fontWeight: '600' }]}>tekrar {due}</Text>
                      </View>
                    )}
                    <Text style={[type.caption, { color: c.textMuted }]}>{known}/{total}</Text>
                  </View>
                </View>
                <View style={[s.progressBg, { backgroundColor: c.barTrack }]}>
                  <View style={[s.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: lvlColor }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STUDYING ─────────────────────────────────────────────────────────────────
  if (phase === 'studying') {
    const total   = queue.length;
    const current = queuePos + 1;
    const pctBar  = Math.round((queuePos / Math.max(total, 1)) * 100);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Header */}
        <View style={s.studyHeader}>
          <TouchableOpacity
            onPress={() => setPhase('browse')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[type.bodyMd, { color: c.accent }]}>‹ Geri</Text>
          </TouchableOpacity>
          <Text style={[type.h3, { color: c.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
            {capitalize(activeCat)}
          </Text>
          <Text style={[type.caption, { color: c.textMuted, minWidth: 36, textAlign: 'right' }]}>
            {current}/{total}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={[s.studyBar, { backgroundColor: c.barTrack }]}>
          <View style={[s.studyBarFill, { width: `${pctBar}%`, backgroundColor: c.accent }]} />
        </View>

        <Flashcard
          word={currentWord}
          onKnow={handleKnow}
          onSkip={handleSkip}
          combo={combo}
          langCode={langConfig.code}
          wordKey={langConfig.wordKey}
        />
      </SafeAreaView>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const allKnown = skipCount === 0 && knowCount > 0;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={s.doneWrap}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>{allKnown ? '🎉' : '💪'}</Text>
          <Text style={[type.h1, { color: c.text, marginBottom: 6 }]}>
            {allKnown ? 'Harika!' : 'Devam et!'}
          </Text>
          <Text style={[type.body, { color: c.textMuted, marginBottom: 32 }]}>
            {capitalize(activeCat)} · {knowCount + skipCount} kart
          </Text>

          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 36, width: '100%' }}>
            <View style={[s.statBox, { backgroundColor: c.successTint, borderColor: c.successBorder }]}>
              <Text style={[type.display, { color: c.success, marginBottom: 4 }]}>{knowCount}</Text>
              <Text style={[type.caption, { color: c.textMuted, fontWeight: '600' }]}>Bildim</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: c.dangerTint, borderColor: c.dangerBorder }]}>
              <Text style={[type.display, { color: c.danger, marginBottom: 4 }]}>{skipCount}</Text>
              <Text style={[type.caption, { color: c.textMuted, fontWeight: '600' }]}>Bilmedim</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: c.primaryBtnBg }]}
            onPress={() => startCategory(activeCat)}
          >
            <Text style={[type.button, { color: c.primaryBtnText }]}>Tekrar Çalış</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: c.panelBorder }]}
            onPress={() => setPhase('browse')}
          >
            <Text style={[type.bodyMd, { color: c.textMuted }]}>Kategorilere Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── Layout-only stiller (renk yok) ──────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
  },
  pillRow: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catListContent: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: 32,
  },
  catCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
  },
  catCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  dueBadge: {
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    minWidth: 4,
  },
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  studyBar: {
    height: 3,
    marginHorizontal: spacing.gutter,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  studyBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  secondaryBtn: {
    width: '100%',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
});
