# CLAUDE.md — Verbyte Native
> Güncellendi: 18.04.2026

---

## Proje Nedir?
Web versiyonundan (fransizca-ogren/) taşınan React Native + Expo uygulaması.

- **Web (kaynak):** `C:\Users\pc\Desktop\site\fransizca-ogren\`
- **Native (bu):** `C:\Users\pc\Desktop\site\verbyte-native\`
- **Çalıştırma:** `npx expo start` → Expo Go ile telefondan tara

---

## Kurulu Bağımlılıklar

| Paket | Amaç |
|-------|------|
| `@react-navigation/native` + `@react-navigation/bottom-tabs` | Navigasyon |
| `react-native-screens` | Native ekran optimizasyonu |
| `react-native-safe-area-context` | Notch / home bar güvenli alan |
| `react-native-gesture-handler` | Swipe, gesture |
| `@react-native-async-storage/async-storage` | localStorage karşılığı |
| `expo-av` | Ses çalma |

---

## Klasör Yapısı

```
verbyte-native/
  App.js                        ← NavigationContainer + BottomTabs
  src/
    screens/
      CardsScreen.js            ← placeholder (web: FlashcardPage)
      QuizScreen.js             ← placeholder (web: QuizPage)
      PracticeScreen.js         ← placeholder (web: SentencesPage)
      ExploreScreen.js          ← placeholder (web: KesfPage)
    utils/                      ← boş, SRS buraya gelecek
```

---

## Web → Native Taşıma Rehberi

| Web | Native karşılığı |
|-----|-----------------|
| `localStorage.getItem/setItem` | `AsyncStorage.getItem/setItem` (async!) |
| CSS dosyaları | `StyleSheet.create({})` |
| `div`, `p`, `button` | `View`, `Text`, `TouchableOpacity` |
| `position: fixed` overlay | `Modal` komponenti |
| Safe area `env()` | `useSafeAreaInsets()` |
| `onClick` | `onPress` |

---

## Sıradaki Adımlar

1. **Test et:** `npx expo start` → Expo Go → 4 tab görünmeli
2. **SRS taşı:** `fransizca-ogren/src/utils/srs.js` → `src/utils/srs.js` (değişiklik yok)
3. **Veri taşı:** `fransizca-ogren/data/fr/` → `assets/data/fr/` + `require()` ile yükle
4. **AsyncStorage:** `srs.js` içinde `localStorage` → `AsyncStorage` (async/await ekle)
5. **CardsScreen:** Gerçek kart komponenti (swipe gesture ile)
6. **QuizScreen:** Mevcut quiz mantığı (timer, choices) native'e port

---

## Renk Paleti (web ile aynı)

```js
const COLORS = {
  bg:       '#0C0B1F',
  surface:  '#151432',
  surface2: '#1E1D40',
  primary:  '#818CF8',
  border:   '#2a2a3d',
  text:     '#E2E8F0',
  muted:    '#64748B',
};
```

---

## Notlar
- Web versiyonu canlıda kalmaya devam ediyor (re-tuel.com/verbyte/)
- Native versiyon şimdilik sadece geliştirme aşamasında
- App Store için Apple Developer hesabı gerekecek ($99/yıl)
- Android için Google Play Console ($25 tek seferlik)
