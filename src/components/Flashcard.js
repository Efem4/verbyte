import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../utils/colors';

const FLIP_DURATION = 300;
const SWIPE_THRESHOLD = 80;

export default function Flashcard({ word, wordKey, onKnow, onSkip, combo, levelColor, isNew }) {
  const [flipped, setFlipped] = useState(false);

  // Flip animation value: 0 = front, 1 = back
  const flipAnim = useRef(new Animated.Value(0)).current;
  // Swipe/drag rotation
  const dragX = useRef(new Animated.Value(0)).current;

  const isFlipped = useRef(false);

  const flipCard = () => {
    const toValue = isFlipped.current ? 0 : 1;
    Animated.timing(flipAnim, {
      toValue,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start(() => {
      isFlipped.current = !isFlipped.current;
      setFlipped(isFlipped.current);
    });
  };

  // Front face rotation: 0 -> 180
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Back face rotation: -180 -> 0
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });

  // Drag tilt (swipe gesture)
  const dragRotate = dragX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5,
      onPanResponderMove: (_, gestureState) => {
        dragX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(dragX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
          onKnow && onKnow();
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.timing(dragX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
          onSkip && onSkip();
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      {/* Combo badge */}
      {combo >= 2 && (
        <View style={styles.comboBadge}>
          <Text style={styles.comboText}>⚡ {combo}x</Text>
        </View>
      )}

      {/* Card with swipe gesture */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ rotate: dragRotate }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* FRONT FACE */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            { transform: [{ rotateY: frontRotate }] },
          ]}
          pointerEvents={flipped ? 'none' : 'auto'}
        >
          <TouchableWithoutFeedback onPress={flipCard}>
            <View style={styles.cardInner}>
              {/* Top row: level badge + isNew badge */}
              <View style={styles.topRow}>
                <View style={[styles.levelBadge, { backgroundColor: levelColor + '22', borderColor: levelColor }]}>
                  <Text style={[styles.levelText, { color: levelColor }]}>{word?.cefr}</Text>
                </View>
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>YENİ</Text>
                  </View>
                )}
              </View>

              {/* Foreign word */}
              <Text style={styles.foreignWord}>{word?.word}</Text>

              {/* Hint */}
              <Text style={styles.hintText}>Çevirmek için dokun</Text>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* BACK FACE */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            { transform: [{ rotateY: backRotate }] },
          ]}
          pointerEvents={flipped ? 'auto' : 'none'}
        >
          <TouchableWithoutFeedback onPress={flipCard}>
            <View style={styles.cardInner}>
              {/* Turkish translation */}
              <Text style={styles.translationWord}>{word?.tr}</Text>

              {/* Example sentence */}
              {word?.example ? (
                <Text style={styles.exampleText}>{word.example}</Text>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </Animated.View>

      {/* Know / Skip buttons — visible only when card is flipped */}
      {flipped && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.skipButton]}
            onPress={onSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.skipButtonText}>✗  Atla</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.knowButton]}
            onPress={onKnow}
            activeOpacity={0.8}
          >
            <Text style={styles.knowButtonText}>✓  Biliyorum</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
  },

  // ── Combo badge ──────────────────────────────────────────────
  comboBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.yellow + '22',
    borderWidth: 1,
    borderColor: COLORS.yellow,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 12,
  },
  comboText: {
    color: COLORS.yellow,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Card container (receives swipe gesture) ──────────────────
  cardContainer: {
    width: '100%',
    aspectRatio: 1.5,
    // perspective is not directly supported in RN; we use the card's own transforms
  },

  // ── Shared card styles ───────────────────────────────────────
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backfaceVisibility: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  cardFront: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardBack: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  cardInner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Front face elements ──────────────────────────────────────
  topRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  newBadge: {
    backgroundColor: COLORS.green + '22',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  newBadgeText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  foreignWord: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  hintText: {
    position: 'absolute',
    bottom: 20,
    fontSize: 13,
    color: COLORS.muted,
  },

  // ── Back face elements ───────────────────────────────────────
  translationWord: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  exampleText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // ── Action buttons ───────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: COLORS.red + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.red,
  },
  skipButtonText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '700',
  },
  knowButton: {
    backgroundColor: COLORS.green + '1A',
    borderWidth: 1.5,
    borderColor: COLORS.green,
  },
  knowButtonText: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: '700',
  },
});
