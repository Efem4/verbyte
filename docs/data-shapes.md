# Veri Şekilleri

## localStorage Anahtarları

| Anahtar | Tip | Açıklama |
|---------|-----|----------|
| `fr_progress` | `LangProgress` | Fransızca SRS ilerlemesi |
| `en_progress` | `LangProgress` | İngilizce SRS ilerlemesi |
| `de_progress` | `LangProgress` | Almanca SRS ilerlemesi |
| `verbyte_streak` | `Streak` | Günlük çalışma serisi |
| `verbyte_achievements` | `string[]` | Kazanılmış rozet id listesi |
| `verbyte_log` | `LogEntry[]` | Kara kutu kayıtları (son 100) |

---

## LangProgress

```js
{
  "greetings": {           // kategori id
    "Bonjour": {           // kelime (wordKey'e göre)
      interval: 3,         // gün cinsinden SRS aralığı (1,3,7,14,30,60)
      due: 1700000000000,  // ms timestamp — ne zaman tekrar gösterilecek
      reps: 2              // toplam kaç kez görüldü
    },
    "Merci": { ... }
  },
  "numbers": { ... }
}
```

**Önemli:** Eski format `{ "greetings": ["Bonjour", "Merci"] }` idi.
`migrateProgress()` bunu otomatik dönüştürür, interval:7 verir.

---

## Streak

```js
{
  count: 5,              // kaç gün üst üste çalışıldı
  lastDate: "2024-01-15" // son çalışma tarihi (YYYY-MM-DD)
}
```

---

## SRS Entry

```js
{
  interval: 7,           // gün cinsinden aralık
  due: 1700000000000,    // ms — Date.now() ile karşılaştırılır
  reps: 3               // toplam tekrar sayısı
}
```

**Interval adımları:** 1 → 3 → 7 → 14 → 30 → 60
**Mastered eşiği:** interval >= 30

---

## LogEntry

```js
{
  ts: "2024-01-15 12:04:33",  // timestamp
  cat: "progress",             // kategori: progress|achievement|streak|error|system
  msg: "✓ Bonjour",           // açıklama
  data: { cat: "greetings", interval: 3 }  // opsiyonel detay
}
```

---

## Achievement

```js
{
  id: "combo_5",          // benzersiz id: {category}_{threshold}
  category: "combo",      // streak | combo | words | mastery
  icon: "⚡",
  label: "Isındım",
  desc: "5 kartı üst üste doğru bil"
}
```

---

## LangConfig (getLangConfig dönüşü)

```js
{
  // LANGS'tan:
  code: "fr",
  flag: "🇫🇷",
  label: "Français",
  sub: "Fransızca öğren",
  wordKey: "fr",
  languageLabel: "Fransızca",

  // vocabulary.js'ten:
  categories: [...],
  vocabulary: { greetings: [...], ... },
  levelColors: { A1: "#...", A2: "#...", B1: "#..." },
  threshold: 0.7,
  speakFn: Function,
  sentenceCategories: [...],

  // hesaplanmış:
  progressKey: "fr_progress"
}
```
