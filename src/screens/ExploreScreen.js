import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../utils/ThemeContext';
import { type, spacing } from '../tokens/verbyte.tokens';

export default function ExploreScreen() {
  const { c } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 48, marginBottom: spacing.xl }}>🧭</Text>
      <Text style={[type.h2, { color: c.text, marginBottom: spacing.md }]}>Keşif</Text>
      <Text style={[type.body, { color: c.textMuted }]}>Yakında burada daha fazlası...</Text>
    </SafeAreaView>
  );
}
