import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CardsScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Kartlar</Text>
      <Text style={s.sub}>Yakında buraya taşınacak</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0B1F', alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 28, fontWeight: '800', color: '#818CF8' },
  sub:       { fontSize: 14, color: '#555', marginTop: 8 },
});
