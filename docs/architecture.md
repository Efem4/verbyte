# Mimari

## Genel Yapı

```
main.jsx
└── ErrorBoundary          → tüm React hatalarını yakalar, logger'a yazar
    └── App.jsx            → state yönetimi merkezi
        ├── FlashcardPage  → kart çalışma ekranı (SRS queue)
        ├── SentencesPage  → cümle okuma ekranı
        └── ProgressPage   → ilerleme + rozetler ekranı
```

## State Yönetimi (App.jsx)

Tüm state App.jsx'te yaşar, aşağıya prop olarak geçer.

| State | Tip | Açıklama |
|-------|-----|----------|
| `langCode` | `string \| null` | Seçili dil. null = landing ekranı |
| `progressByLang` | `{ [langCode]: LangProgress }` | Tüm dillerin SRS ilerlemesi |
| `streak` | `{ count: number, lastDate: string }` | Günlük çalışma serisi |
| `earned` | `Set<string>` | Kazanılmış rozet id'leri |
| `toastQueue` | `Achievement[]` | Gösterilecek rozet bildirimleri |

## Veri Akışı

```
Kullanıcı kart kaydırır
  → FlashcardPage.handleKnow()
    → App.handleProgress(catId, word, correct=true)
      → SRS.updateEntry() → yeni interval hesapla
      → logger.log('progress', ...)
      → localStorage'a kaydet
    → App.handleStudy()
      → streak güncelle
    → App.handleComboChange(n)
      → achievement kontrolü
```

## Dil Mimarisi

```
languageRegistry.js
├── LANGS[]              → dil listesi (code, flag, label, sub)
└── getLangConfig(code)  → tek dil için birleşik config objesi döner

src/languages/
├── fr/vocabulary.js     → categories[], vocabulary{}, levelColors, UNLOCK_THRESHOLD
├── en/vocabulary.js     → aynı yapı
└── de/vocabulary.js     → aynı yapı
```

## Routing

Router yok. Tab state ile çalışır:
- `langCode === null` → landing ekranı
- `tab === 'flashcards'` → FlashcardPage
- `tab === 'sentences'` → SentencesPage
- `tab === 'progress'` → ProgressPage
