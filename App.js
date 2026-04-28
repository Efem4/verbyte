import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';

import { ThemeProvider, useTheme } from './src/utils/ThemeContext';
import { loadLangConfig, loadLevel, LEVELS } from './src/config/languageRegistry';
import { colors } from './src/tokens/verbyte.tokens';

import CardsScreen    from './src/screens/CardsScreen';
import QuizScreen     from './src/screens/QuizScreen';
import PracticeScreen from './src/screens/PracticeScreen';
import ExploreScreen  from './src/screens/ExploreScreen';
import ProgressScreen from './src/screens/ProgressScreen';

const Tab = createBottomTabNavigator();
const ICONS = {
  Kartlar:    '📖',
  Quiz:       '⚡',
  Pratik:     '✏️',
  'Keşif':   '🧭',
  'İlerleme': '📊',
};

// ── İç navigator — ThemeProvider içinde, temaya erişebilir ──
function AppNavigator({ langConfig, onStudy }) {
  const { c } = useTheme();
  const screenProps = { langConfig, onStudy };

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
              {ICONS[route.name]}
            </Text>
          ),
          tabBarActiveTintColor:   c.accent,
          tabBarInactiveTintColor: c.textFaint,
          tabBarStyle: {
            backgroundColor: c.navBg,
            borderTopColor:  c.navBorder,
            borderTopWidth:  1,
            paddingBottom:   4,
            height:          62,
          },
          tabBarLabelStyle: {
            fontSize:      10,
            fontFamily:    'GeistMono-Regular',
            letterSpacing: 0.4,
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
  );
}

// ── Root ──────────────────────────────────────────────────────
export default function App() {
  const [langConfig, setLangConfig] = useState(null);
  const [loading, setLoading]       = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    'Geist':             require('./assets/fonts/Geist-Regular.ttf'),
    'Geist-Regular':     require('./assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium':      require('./assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold':    require('./assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold':        require('./assets/fonts/Geist-Bold.ttf'),
    'GeistMono-Regular': require('./assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Medium':  require('./assets/fonts/GeistMono-Medium.ttf'),
  });

  useEffect(() => {
    loadLangConfig('fr')
      .then(cfg => { setLangConfig(cfg); setLoading(false); })
      .catch(e => { console.warn('Veri yüklenemedi:', e); setLoading(false); });
  }, []);

  async function handleUnlockCheck() {
    if (!langConfig) return;
    const { code, loadedLevels } = langConfig;
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const level     = LEVELS[i];
      const nextLevel = LEVELS[i + 1];
      if (!loadedLevels.has(level) || loadedLevels.has(nextLevel)) continue;
      const cfg = await loadLevel(code, nextLevel);
      setLangConfig(cfg);
      break;
    }
  }

  // Font yüklenene kadar bekle
  if (!fontsLoaded && !fontError) return null;

  if (loading) {
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>Verbyte</Text>
        <ActivityIndicator color={colors.dark.accent} style={{ marginTop: 24 }} />
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

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <AppNavigator langConfig={langConfig} onStudy={handleUnlockCheck} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.dark.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.dark.accent,
    letterSpacing: -2,
  },
  splashSub: {
    fontSize: 14,
    color: colors.dark.textMuted,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
