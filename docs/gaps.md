# Test Edilmeyen Alanlar & Bilinen Edge Case'ler

## Test Edilmeyenler

### Component testleri yok
FlashcardPage, ProgressPage, App.jsx için render testleri yok.
Bozulursa sadece build hatası veya runtime'da görülür.

### SentencesPage
Hiç test yok. Basit bileşen ama ses çalma ve cümle gösterimi test edilmemiş.

### Ses sistemi (speak.js)
`audioMap.json` → MP3 URL dönüşümü test edilmiyor. Ses dosyası eksikse sessizce başarısız olur.

### logger.js
localStorage dolu olduğunda (QuotaExceededError) ne olduğu test edilmedi. Şu an try/catch ile sessizce geçiyor.

---

## Bilinen Edge Case'ler

### SRS migration yarım kalırsa
Eğer `migrateProgress` çalışırken tarayıcı kapanırsa, localStorage'da karışık format kalabilir (bazı kategoriler array, bazıları object). `migrateProgress` bunu handle ediyor ama tam test edilmedi.

### Streak gece yarısı
Kullanıcı 23:59'da ve 00:01'de çalışırsa iki farklı gün sayılır. Bu doğru davranış ama bazı kullanıcılar için sürpriz olabilir.

### Combo cross-category
Combo kategoriler arası sıfırlanmıyor — bir kategoride 5 combo yapıp başka kategoriye geçersen combo devam eder. Bu kasıtlı mı? Karar log'unda yok.

### Achievement kontrolü her progress'te çalışıyor
`triggerAchievements` her kart kaydırmada tüm 12 achievement'ı kontrol ediyor. 12 tane az ama kelime sayısı artarsa yavaşlayabilir.

### Büyük kelime listesi + buildQueue
Kategori 100+ kelime içerse buildQueue her render'da çalışmıyor (sadece startCategory'de), bu yüzden sorun yok. Ama dikkat edilmeli.

---

## Eksik Özellikler (gelecek)

- [ ] Quiz modu (çoktan seçmeli)
- [ ] Cümle SRS'i (şu an sadece kelime SRS'i var)
- [ ] Offline ses (şu an CDN'den yükleniyor)
- [ ] İstatistik geçmişi (bu hafta kaç kelime çalıştım)
