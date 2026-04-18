import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS, LEVEL_COLORS } from '../utils/colors';
import { buildSmartQueue, updateEntry, getDueCount, getMasteredCount } from '../utils/srs';
import storage from '../utils/storage';
import { getAudioUrl } from '../utils/audioConfig';

// ─── Sabitler ────────────────────────────────────────────────────────────────
const LEVELS    = ['A1', 'A2', 'B1', 'B2', 'C1'];
const NEW_LIMIT = 5;

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// ─── Dahili Flashcard komponenti ─────────────────────────────────────────────
const { width } = Dimensions.get('window');

function Flashcard({ word, onKnow, onSkip, combo, langCode, wordKey }) {
  const [flipped, setFlipped] = useState(false);
  const flipAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const soundRef  = useRef(null);

  // Yeni kart geldiğinde ön yüze sıfırla
  useEffect(() => {
    setFlipped(false);
    flipAnim.setValue(0);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [word?.id]);

  // Yeni kart geldiğinde sesi çal
  useEffect(() => {
    if (!word?.id) return;
    let sound;
    const url = getAudioUrl(langCode, word.id);
    Audio.Sound.createAsync({ uri: url })
      .then(({ sound: s }) => {
        sound = s;
        soundRef.current = s;
        s.playAsync().catch(() => {});
      })
      .catch(() => {});
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [word?.id]);

  const playSound = () => {
    if (!word?.id) return;
    const url = getAudioUrl(langCode, word.id);
    Audio.Sound.createAsync({ uri: url })
      .then(({ sound: s }) => {
        s.playAsync().catch(() => {});
        s.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) s.unloadAsync().catch(() => {});
        });
      })
      .catch(() => {});
  };

  const frontRotate = flipAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const handleFlip = () => {
    Animated.spring(flipAnim, {
      toValue:  flipped ? 0 : 1,
      friction: 8,
      tension:  10,
      useNativeDriver: true,
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
        <View style={fc.comboBadge}>
          <Text style={fc.comboText}>🔥 {combo} combo</Text>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.9} onPress={handleFlip}>
        <Animated.View style={[fc.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Ön yüz */}
          <Animated.View
            style={[fc.face, fc.front, { transform: [{ rotateY: frontRotate }] }]}
            pointerEvents={flipped ? 'none' : 'auto'}
          >
            <Text style={fc.catLabel}>{capitalize(word.cat)}</Text>
            <Text style={fc.wordText}>{word[wordKey]}</Text>
            <Text style={fc.tapHint}>Çevirmek için dokun</Text>
            <TouchableOpacity
              style={fc.soundBtn}
              onPress={e => { e.stopPropagation?.(); playSound(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={fc.soundBtnIcon}>🔊</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Arka yüz */}
          <Animated.View
            style={[fc.face, fc.back, { transform: [{ rotateY: backRotate }] }]}
            pointerEvents={flipped ? 'auto' : 'none'}
          >
            <Text style={fc.catLabel}>{capitalize(word.cat)}</Text>
            <Text style={fc.trText}>{word.tr}</Text>
            {!!word.example && (
              <Text style={fc.exampleText}>"{word.example}"</Text>
            )}
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      <View style={fc.btnRow}>
        <TouchableOpacity style={[fc.btn, fc.skipBtn]} onPress={handleSkip}>
          <Text style={fc.btnIcon}>✕</Text>
          <Text style={fc.btnLabel}>Bilmiyorum</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[fc.btn, fc.knowBtn]} onPress={handleKnow}>
          <Text style={fc.btnIcon}>✓</Text>
          <Text style={fc.btnLabel}>Bildim</Text>
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
    paddingHorizontal: 20,
  },
  comboBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  comboText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    width: width - 40,
    height: 260,
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backfaceVisibility: 'hidden',
    borderWidth: 1,
  },
  front: {
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.borderStrong,
  },
  back: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },
  catLabel: {
    position: 'absolute',
    top: 16,
    left: 20,
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  wordText: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 16,
    fontSize: 12,
    color: COLORS.muted,
  },
  soundBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  soundBtnIcon: {
    fontSize: 18,
  },
  trText: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 19,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  skipBtn: {
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderColor:     'rgba(248,113,113,0.35)',
  },
  knowBtn: {
    backgroundColor: 'rgba(52,211,153,0.10)',
    borderColor:     'rgba(52,211,153,0.35)',
  },
  btnIcon: {
    fontSize: 22,
    marginBottom: 2,
    color: COLORS.text,
  },
  btnLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function CardsScreen({ langConfig }) {
  // Phase yönetimi
  const [phase, setPhase]             = useState('browse');   // 'browse' | 'studying' | 'done'
  const [activeLevel, setActiveLevel] = useState('A1');
  const [progress, setProgress]       = useState({});         // progress kayıtları

  // Studying state
  const [activeCat, setActiveCat]     = useState(null);
  const [queue, setQueue]             = useState([]);          // word index dizisi
  const [queuePos, setQueuePos]       = useState(0);
  const [knowCount, setKnowCount]     = useState(0);
  const [skipCount, setSkipCount]     = useState(0);
  const [combo, setCombo]             = useState(0);

  // ── İlk yükleme ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!langConfig?.progressKey) return;
    (async () => {
      const saved = await storage.getJSON(langConfig.progressKey, {});
      setProgress(saved);
    })();
  }, [langConfig?.progressKey]);

  // ── Progress kaydet ──────────────────────────────────────────────────────
  const saveProgress = useCallback(async (newProg) => {
    setProgress(newProg);
    await storage.setJSON(langConfig.progressKey, newProg);
  }, [langConfig?.progressKey]);

  // ── Kategori başlat ─────────────────────────────────────────────────────
  const startCategory = useCallback((catId) => {
    const vocabulary = langConfig?.vocabulary ?? {};
    const words = vocabulary[catId] ?? [];
    if (!words.length) return;
    const catProgress = progress[catId] ?? {};
    const q = buildSmartQueue(words, langConfig.wordKey, catProgress, NEW_LIMIT);
    setActiveCat(catId);
    setQueue(q);
    setQueuePos(0);
    setKnowCount(0);
    setSkipCount(0);
    setCombo(0);
    setPhase('studying');
  }, [langConfig, progress]);

  // ── Mevcut kelime ────────────────────────────────────────────────────────
  const vocabulary    = langConfig?.vocabulary ?? {};
  const currentWords  = activeCat ? (vocabulary[activeCat] ?? []) : [];
  const currentWord   = queue.length > 0 ? currentWords[queue[queuePos]] : null;

  // ── İleri git ────────────────────────────────────────────────────────────
  const advance = useCallback((currentQueue) => {
    setQueuePos(pos => {
      const next = pos + 1;
      if (next >= currentQueue.length) {
        setPhase('done');
        return pos;
      }
      return next;
    });
  }, []);

  // ── Know ─────────────────────────────────────────────────────────────────
  const handleKnow = useCallback(async () => {
    if (!currentWord || !activeCat) return;
    const wordKey = langConfig?.wordKey ?? 'id';
    const catProgress = progress[activeCat] ?? {};
    const entry   = catProgress[currentWord[wordKey]];
    const updated = updateEntry(entry, true);
    const newProg = {
      ...progress,
      [activeCat]: { ...catProgress, [currentWord[wordKey]]: updated },
    };
    await saveProgress(newProg);
    setKnowCount(c => c + 1);
    setCombo(c => c + 1);
    advance(queue);
  }, [currentWord, activeCat, progress, saveProgress, queue, advance]);

  // ── Skip ─────────────────────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (!currentWord || !activeCat) return;
    const wordKey = langConfig?.wordKey ?? 'id';
    const catProgress = progress[activeCat] ?? {};
    const entry   = catProgress[currentWord[wordKey]];
    const updated = updateEntry(entry, false);
    const newProg = {
      ...progress,
      [activeCat]: { ...catProgress, [currentWord[wordKey]]: updated },
    };
    await saveProgress(newProg);
    setSkipCount(c => c + 1);
    setCombo(0);
    advance(queue);
  }, [currentWord, activeCat, progress, saveProgress, queue, advance]);

  // ── Kategori istatistikleri ──────────────────────────────────────────────
  const getCatStats = useCallback((catId, words) => {
    const catProg = progress[catId] ?? {};
    return {
      total: words.length,
      known: getMasteredCount(catProg),
      due:   getDueCount(words, langConfig?.wordKey ?? 'id', catProg),
    };
  }, [progress, langConfig?.wordKey]);

  // ── langConfig yoksa loading göster ─────────────────────────────────────
  if (!langConfig || !langConfig.vocabulary) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.muted, fontSize: 15 }}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: browse
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'browse') {
    // langConfig.vocabulary zaten catId → [words] formatında gruplanmış
    // langConfig.categories → [{ id, label, emoji, level }]
    // Aktif seviyeye göre kategorileri filtrele
    const levelCatIds = (langConfig.categories ?? [])
      .filter(c => c.level === activeLevel || !c.level)
      .map(c => c.id);

    // vocabulary'den sadece bu level'a ait kategorileri al
    // level bilgisi yoksa tüm vocabulary'yi göster
    const levelCats = levelCatIds.length > 0
      ? Object.fromEntries(
          levelCatIds
            .filter(id => langConfig.vocabulary[id])
            .map(id => [id, langConfig.vocabulary[id]])
        )
      : langConfig.vocabulary;

    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

        {/* Başlık */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Kartlar</Text>
          <Text style={s.headerSub}>{langConfig.languageLabel} kelime çalış</Text>
        </View>

        {/* Level pill navigator */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillRow}
        >
          {LEVELS.map(lvl => {
            const isActive   = lvl === activeLevel;
            const isUnlocked = langConfig.loadedLevels
              ? langConfig.loadedLevels.has(lvl)
              : lvl === 'A1';
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  s.pill,
                  isActive   && { backgroundColor: (langConfig.levelColors ?? LEVEL_COLORS)[lvl] },
                  !isUnlocked && s.pillLocked,
                ]}
                onPress={() => isUnlocked && setActiveLevel(lvl)}
                activeOpacity={isUnlocked ? 0.7 : 1}
              >
                <Text style={[s.pillText, isActive && s.pillTextActive]}>
                  {lvl}
                </Text>
                {!isUnlocked && <Text style={s.lockIcon}>🔒</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Kategori listesi */}
        <ScrollView
          style={s.catList}
          contentContainerStyle={s.catListContent}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(levelCats).map(([catId, words]) => {
            const { total, known, due } = getCatStats(catId, words);
            const pct = total > 0 ? known / total : 0;
            const catMeta = (langConfig.categories ?? []).find(c => c.id === catId);
            const catLabel = catMeta
              ? `${catMeta.emoji ?? ''} ${catMeta.label ?? capitalize(catId)}`.trim()
              : capitalize(catId);
            const levelColor = (langConfig.levelColors ?? LEVEL_COLORS)[activeLevel];

            return (
              <TouchableOpacity
                key={catId}
                style={s.catCard}
                onPress={() => startCategory(catId)}
                activeOpacity={0.75}
              >
                <View style={s.catCardTop}>
                  <Text style={s.catName}>{catLabel}</Text>
                  <View style={s.catRight}>
                    {due > 0 && (
                      <View style={s.dueBadge}>
                        <Text style={s.dueBadgeText}>tekrar {due}</Text>
                      </View>
                    )}
                    <Text style={s.catCount}>{known}/{total}</Text>
                  </View>
                </View>
                <View style={s.progressBg}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${Math.round(pct * 100)}%`,
                        backgroundColor: levelColor,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: studying
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'studying') {
    const total   = queue.length;
    const current = queuePos + 1;

    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

        {/* Header */}
        <View style={s.studyHeader}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => setPhase('browse')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.backBtnText}>‹ Geri</Text>
          </TouchableOpacity>
          <Text style={s.studyCatName} numberOfLines={1}>
            {capitalize(activeCat)}
          </Text>
          <Text style={s.studyProgress}>{current}/{total}</Text>
        </View>

        {/* İlerleme şeridi */}
        <View style={s.studyBar}>
          <View
            style={[
              s.studyBarFill,
              { width: `${Math.round((queuePos / Math.max(total, 1)) * 100)}%` },
            ]}
          />
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

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: done
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'done') {
    const allKnown = skipCount === 0 && knowCount > 0;

    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

        <View style={s.doneWrap}>
          <Text style={s.doneEmoji}>{allKnown ? '🎉' : '💪'}</Text>
          <Text style={s.doneTitle}>{allKnown ? 'Harika!' : 'Devam et!'}</Text>
          <Text style={s.doneSub}>
            {capitalize(activeCat)} · {knowCount + skipCount} kart
          </Text>

          <View style={s.doneStats}>
            <View style={[s.statBox, s.statBoxGreen]}>
              <Text style={[s.statNum, { color: COLORS.green }]}>{knowCount}</Text>
              <Text style={s.statLabel}>Bildim</Text>
            </View>
            <View style={[s.statBox, s.statBoxRed]}>
              <Text style={[s.statNum, { color: COLORS.red }]}>{skipCount}</Text>
              <Text style={s.statLabel}>Bilmedim</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => startCategory(activeCat)}
          >
            <Text style={s.primaryBtnText}>Tekrar Çalış</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => setPhase('browse')}
          >
            <Text style={s.secondaryBtnText}>Kategorilere Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Browse — header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },

  // Browse — level pills
  pillRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillLocked: {
    opacity: 0.45,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
  },
  pillTextActive: {
    color: '#1a0a2e',
  },
  lockIcon: {
    fontSize: 10,
  },

  // Browse — kategori listesi
  catList: {
    flex: 1,
  },
  catListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 10,
  },
  catCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  catName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueBadge: {
    backgroundColor: 'rgba(129,140,248,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.3)',
  },
  dueBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  catCount: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  progressBg: {
    height: 5,
    backgroundColor: COLORS.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },

  // Studying — header
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  studyCatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  studyProgress: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  studyBar: {
    height: 3,
    backgroundColor: COLORS.surface2,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  studyBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // Done
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  doneEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  doneSub: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 32,
  },
  doneStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 36,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  statBoxGreen: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor:     'rgba(52,211,153,0.25)',
  },
  statBoxRed: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor:     'rgba(248,113,113,0.25)',
  },
  statNum: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C0B1F',
  },
  secondaryBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
  },
});
