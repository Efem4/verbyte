# CLAUDE.md — Verbyte Proje Bağlamı
> Güncellendi: 17.04.2026

---

## 🎼 Orkestra Protokolü (Token Yönetimi)

> Bu bölüm benim (ana Claude) ekibi nasıl yönettiğimi tanımlar.
> Amaç: context'i temiz tutmak, token israfını önlemek.

### Ekip
| İsim | Dosyalar | Uzmanlık |
|------|----------|----------|
| **Altan** | src/components/*.jsx, *.css | UI, animasyon |
| **Mehmet** | scripts/, public/data/ | Veri, pipeline |
| **Ayşe** | *.test.js, lint | Test, kalite |
| **Deniz** | vite.config, wrangler, deploy | Build, deploy |
| **Selin** | scripts/audio*, audioConfig.js | Ses sistemi |
| **Kerem** | App.jsx, languageRegistry, srs.js | Mimari, SRS |
| **Hızır** | herhangi (tek dosya) | Hızlı fix |
| **Zara** | herhangi (sadece okur) | Araştırma |

### Karar Kuralları

**Ne zaman paralel çalıştır:**
- Farklı dosyalara dokunan ≥2 bağımsız görev varsa → aynı mesajda birden fazla Agent çağrısı

**Ne zaman background'a at (`run_in_background: true`):**
- Tahmini süre > 2 dakika (script çalıştırma, büyük veri işleme)
- Kullanıcı sonucu hemen görmeyecekse
- Paralel ajanlar uzun sürecekse

**Ne zaman sıralı çalıştır:**
- B görevi A'nın sonucuna bağlıysa (örn: Zara araştırır → Kerem uygular)
- Aynı dosyaya iki ajan dokunacaksa

**Ne zaman Zara'yı öne çıkar:**
- İstek belirsizse ("bunu düzelt" ama tam olarak ne bilinmiyorsa)
- Büyük değişiklik öncesi etki analizi gerekiyorsa

### Token Tasarrufu Kuralları (benim için)
1. Ajanlara "kodu konuşmaya yazma, sadece ne değişti listele" derim
2. Agent sonucu = max 20 satır özet (dosya adı + ne değişti)
3. Build/test sonuçlarını kopyalamam — sadece ✅/❌ gösteririm
4. Büyük kod bloklarını konuşmaya yapıştırmam — kullanıcı dosyayı okuyabilir
5. Session uzarsa: `git commit` → yeni session'da CLAUDE.md yeterli context sağlar

### Commit Protokolü
Her tamamlanan özellik sonrası:
```bash
git add -A && git commit -m "feat: [özellik adı]"
```
Session bitmeden önce commit → CLAUDE.md ile bir sonraki session sorunsuz devam eder.

---

## Proje Nedir?
React + Vite ile yapılmış çok dilli kelime öğrenme uygulaması.
- **Deploy:** Cloudflare Workers → `re-tuel.com/verbyte/`
- **Deploy komutu:** `retuel-site/` klasöründe `npx wrangler deploy`
- **Build çıktısı:** `fransizca-ogren/dist/` → `retuel-site/verbyte/` klasörüne kopyalanır
- **Şifre koruması:** `retuel-site/worker.js` içinde password gate var

## Durum
| | |
|--|--|
| Testler | ✅ 161/161 geçti (3 test dosyası) |
| Lint | ✅ temiz |
| Son deploy | 15.04.2026 — Cloudflare Workers |

---

## Mimari Özeti

```
main.jsx → ErrorBoundary → App.jsx
  ├── FlashcardPage   (SRS queue, swipe, kart efektleri, combo)
  ├── QuizPage        (Classic/Zen/∞ mod, TR↔Kelime yön toggle, floating skor)
  ├── SentencesPage   (Boşluk Doldur, Kelime Sırala, ✏️ Yaz [WriteMode], Keşif)
  ├── KesfPage        (kategori keşif, swipe)
  └── ProgressPage    (istatistik, SRS dağılımı, level accordion A1→C1)
```

**Header:** theme toggle (☀️/🌙) | streak badge (🔥)
**Bottom nav:** Cards | Quiz | Pratik
**Ana state App.jsx'te:** `langCode`, `tab`, `progressByLang`, `streak`, `theme`, `langConfig`

---

## Veri Mimarisi (v2.0 — CEFR Lazy Loading)

### Veri Dosyaları
```
data/
  shared/
    categories.json        → tüm diller için ortak kategori meta (id, label, emoji, cefr)
    google-10k.txt
    popmots-en-fr.json
  fr/  (14160 kelime, 3793 cümle, 41 kategori)
  en/  (9162 kelime, 14262 cümle, 30 kategori)
  de/  (8562 kelime, 14259 cümle, 30 kategori)
    A1.json / A2.json / B1.json / B2.json / C1.json     → kelimeler (kategori CEFR'e göre split)
    sentences-A1.json / ... / sentences-C1.json          → cümleler
    meta.json                                             → wordCount, sentenceCount, vb.
    audio.json                                            → ses dosyası mapping
```

**ÖNEMLİ:** Kelimeler `word.cefr` değil **`category.cefr`** değerine göre split edilmiştir.
(724 kelimede word.cefr ≠ category.cefr uyumsuzluğu vardı, category.cefr referans alındı)

### languageRegistry.js (`src/config/`)
Lazy loading motoru:
- Başlangıçta sadece **A1** yüklenir
- Önceki level ≥ %70 tamamlandığında sonraki level otomatik unlock+yüklenir
- `UNLOCK_THRESHOLD = 0.7`
- `LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']`

```js
loadLangConfig(code)         // A1 yükler, config snapshot döner
loadLevel(code, level)       // tek level lazy yükler, cache'e merge eder
loadSentenceCategories(code) // yüklü word level'lara ait cümleleri yükler
isLevelLoaded(code, level)   // boolean
getConfig(code)              // mevcut cache snapshot'ı döner
```

Cache yapısı: `{ loadedLevels: Set, loadedSentLevels: Set, categories, vocabulary, words, sentenceCategories }`

---

## Bileşenler

### Flashcard.jsx
- **Particle burst efekti** → ✓ Bildim butonunda 12 parçacık (CSS `--tx`/`--ty`)
- **Shake efekti** → ✗ Bilmedim butonunda DOM classList + `offsetWidth` reflow
- **🆕 Yeni badge** → ilk kez görülen kelimelerde animasyonlu yeşil badge
- **Kart arkası** → çeviri + örnek cümle bloğu
- **State reset** → `key={word.id}` ile React remount (useEffect yerine)

### QuizPage.jsx
- **3 mod:** Classic (10s timer), Zen (süresiz), ∞ (100 soru)
- **Yön toggle:** TR→Kelime (varsayılan) | Kelime→TR
- **Floating skor** → doğru cevapta `+1` animasyonu (CSS `--fx` pozisyon)
- **Setup ekranı:** Kategori seç → Mod seç → Yön seç → Başla

### SentencesPage.jsx
- **4 mod:** Boşluk Doldur, Kelime Sırala, ✏️ Yaz (WriteMode), Keşif
- **WriteMode:** Cümledeki boş yeri yaz, fuzzy match (Levenshtein ≤2 = "Çok yakın!")
  - `q[wordKey]` = boşluklu cümle, `q.tip` = Türkçe ipucu, `q.answer` = doğru kelime
- **SortMode:** Doğru pozisyondaki chip'ler anlık yeşil renk

### FlashcardPage.jsx
- SRS queue yönetimi
- Level unlock kontrolü → `onLoadLevel` prop ile App.jsx'e bildirir
- Yüklenmemiş level için `…` gösterimi

---

## Util'ler

| Dosya | İçerik |
|-------|--------|
| `src/utils/srs.js` | SRS motoru: `updateEntry`, `buildQueue`, `migrateProgress` |
| `src/utils/achievements.js` | 13 rozet, `checkNew()` |
| `src/utils/logger.js` | kara kutu kayıt (localStorage) |

---

## localStorage Anahtarları

| Anahtar | İçerik |
|---------|--------|
| `fr_progress` / `en_progress` / `de_progress` | SRS: `{ word: {interval, due, reps} }` |
| `verbyte_streak` | `{ count, lastDate }` |
| `verbyte_achievements` | `string[]` (kazanılan rozet id'leri) |
| `verbyte_theme` | `'light'` veya `'dark'` |

---

## CSS Theming
- **Dark** (varsayılan): `--bg:#0C0B1F`, `--surface:#151432`, `--primary:#818CF8`
- **Light:** `[data-theme="light"]` override — lavender/indigo palette
- `document.documentElement` üzerine `data-theme` attribute

---

## Komutlar

```bash
npm run dev          → geliştirme sunucusu (port 5174)
npm run build        → dist/ klasörüne build
npm run lint         → ESLint kontrol
npm run test         → tüm testler (151 test, ~440ms)
npm run test:app     → sadece srs + achievement testleri
npm run test:data    → sadece veri testleri
npm run deploy       → test + build + deploy script (scripts/deploy.mjs)
```

**Manuel deploy:**
```bash
# 1. Build
cd fransizca-ogren && npm run build

# 2. Kopyala
rm -rf ../retuel-site/verbyte && cp -r dist ../retuel-site/verbyte

# 3. Deploy
cd ../retuel-site && npx wrangler deploy
```

---

## Test Dosyaları

| Dosya | Kapsam |
|-------|--------|
| `src/utils/srs.test.js` | SRS algoritması |
| `src/utils/achievements.test.js` | Rozet sistemi |
| `src/tests/data.test.js` | JSON veri bütünlüğü (fr/en/de × A1-C1) |

---

## Klasör Yapısı

```
fransizca-ogren/
  src/
    App.jsx / App.css
    main.jsx
    components/
      Flashcard.jsx / Flashcard.css
      FlashcardPage.jsx
      QuizPage.jsx / QuizPage.css
      SentencesPage.jsx
      KesfPage.jsx / KesfPage.css
      ProgressPage.jsx
      AchievementToast.jsx / AchievementToast.css
      ErrorBoundary.jsx / ErrorBoundary.css
    config/
      languageRegistry.js
    utils/
      srs.js / srs.test.js
      achievements.js / achievements.test.js
      logger.js
    tests/
      data.test.js
  data/
    shared/categories.json
    fr/ en/ de/   → A1-C1.json, sentences-A1-C1.json, meta.json, audio.json
  public/
    audio/ audio-en/ audio-de/   → ses dosyaları
  scripts/
    migrate.mjs / sync.mjs / audio.mjs / deploy.mjs
  vite.config.js   (base: '/verbyte/')
  CLAUDE.md        (bu dosya)
```
