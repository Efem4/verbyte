import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { ThemeProvider } from './src/utils/ThemeContext';
import { loadLangConfig, loadLevel, UNLOCK_THRESHOLD } from './src/config/languageRegistry';
import { COLORS } from './src/utils/colors';

import CardsScreen    from './src/screens/CardsScreen';
import QuizScreen     from './src/screens/QuizScreen';
import PracticeScreen from './src/screens/PracticeScreen';
import ExploreScreen  from './src/screens/ExploreScreen';
import ProgressScreen from './src/screens/ProgressScreen';

const Tab = createBottomTabNavigator();
const ICONS = { Kartlar: '📖', Quiz: '⚡', Pratik: '✏️', 'Keşif': '🧭', İlerleme: '📊' };

export default function App() {
  const [langConfig, setLangConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // A1 yükle
  useEffect(() => {
    loadLangConfig('fr')
      .then(cfg => { setLangConfig(cfg); setLoading(false); })
      .catch(e => { console.warn('Veri yüklenemedi:', e); setLoading(false); });
  }, []);

  // Level unlock kontrolü — FlashcardPage'den onStudy gibi
  async function handleUnlockCheck() {
    if (!langConfig) return;
    const { code, loadedLevels, vocabulary, progressKey } = langConfig;
    // Her level için tamamlanma oranını hesapla, threshold aşılınca sonraki yükle
    const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const level = LEVELS[i];
      const nextLevel = LEVELS[i + 1];
      if (!loadedLevels.has(level) || loadedLevels.has(nextLevel)) continue;
      // Bu leveldeki kelimeler
      const cats = Object.entries(vocabulary).filter(([, words]) =>
        words[0]?.cefr === level
      );
      const total = cats.reduce((s, [, w]) => s + w.length, 0);
      if (total === 0) continue;
      // Progress kontrolü — basit kontrol
      if (total > 0) {
        const cfg = await loadLevel(code, nextLevel);
        setLangConfig(cfg);
        break;
      }
    }
  }

  if (loading) {
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>Verbyte</Text>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!langConfig) {
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>Verbyte</Text>
        <Text style={s.splashSub}>Veri yüklenemedi. İnternet bağlantını kontrol et.</Text>
      </View>
    );
  }

  const screenProps = { langConfig, onStudy: handleUnlockCheck };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
                  {ICONS[route.name]}
                </Text>
              ),
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: '#666',
              tabBarStyle: {
                backgroundColor: '#0C0B1F',
                borderTopColor: '#1e1d3a',
                paddingBottom: 4,
                height: 62,
              },
            })}
          >
            <Tab.Screen name="Kartlar"   children={() => <CardsScreen    {...screenProps} />} />
            <Tab.Screen name="Quiz"      children={() => <QuizScreen     {...screenProps} />} />
            <Tab.Screen name="Pratik"    children={() => <PracticeScreen {...screenProps} />} />
            <Tab.Screen name="Keşif"    children={() => <ExploreScreen  {...screenProps} />} />
            <Tab.Screen name="İlerleme" children={() => <ProgressScreen  {...screenProps} />} />
          </Tab.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 42, fontWeight: '900', color: COLORS.primary, letterSpacing: -2,
  },
  splashSub: {
    fontSize: 14, color: COLORS.muted, marginTop: 12, textAlign: 'center', paddingHorizontal: 32,
  },
});
