import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { ThemeProvider } from './src/utils/ThemeContext';

import CardsScreen    from './src/screens/CardsScreen';
import QuizScreen     from './src/screens/QuizScreen';
import PracticeScreen from './src/screens/PracticeScreen';
import ExploreScreen  from './src/screens/ExploreScreen';
import ProgressScreen from './src/screens/ProgressScreen';

const Tab = createBottomTabNavigator();

const ICONS = { Kartlar: '📖', Quiz: '⚡', Pratik: '✏️', 'Keşif': '🧭', İlerleme: '📊' };

export default function App() {
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
            tabBarActiveTintColor: '#818CF8',
            tabBarInactiveTintColor: '#666',
            tabBarStyle: {
              backgroundColor: '#0C0B1F',
              borderTopColor: '#1e1d3a',
              paddingBottom: 4,
              height: 62,
            },
          })}
        >
          <Tab.Screen name="Kartlar"  component={CardsScreen} />
          <Tab.Screen name="Quiz"     component={QuizScreen} />
          <Tab.Screen name="Pratik"   component={PracticeScreen} />
          <Tab.Screen name="Keşif"   component={ExploreScreen} />
          <Tab.Screen name="İlerleme" component={ProgressScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
