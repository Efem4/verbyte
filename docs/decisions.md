# Karar Günlüğü

## SRS: Yanlış kelimeler kaydedilmez

**Karar:** `handleSkip` (bilmiyorum) `onProgress` çağırmaz — yanlış kelimeler SRS'e girmez.

**Neden:** Kullanıcı önerdi. Yanlış kelime sıfırlanır, yarın yeni kart gibi gelir. SRS sadece doğruları takip eder. Sistem daha temiz, "kötü interval" birikmiyor.

---

## SRS: Aynı turda geri ekleme yok

**Karar:** Yanlış kart o turda tekrar gösterilmez, düz ilerler.

**Neden:** Kullanıcı test gibi çalışmasını istedi. Yanlışlar yarın gelir (SRS'e girmediği için her gün görünür).

---

## Streak: Günlük, kart kaydırınca başlar

**Karar:** İlk kart kaydırılınca gün sayılır (`onStudy` tetiklenir).

**Neden:** Sadece uygulamayı açmak sayılmamalı, gerçekten çalışmak gerekiyor.

---

## Rozet sistemi: 12 rozet, 4 kategori

**Karar:** Streak(3), Combo(3), Kelime(3), Ustalık(3) — toplamda 12.

**Neden:** Fazla rozet dikkat dağıtır. Hepsi erişilebilir ama kolay değil.

---

## Progress format: Dil bazlı ayrı storage

**Karar:** `fr_progress`, `en_progress`, `de_progress` — ayrı anahtarlar.

**Neden:** Bir dili sıfırlamak diğerini etkilemesin. Her dilin ilerlemesi bağımsız.

---

## Seviye kilidi: %70 eşiği

**Karar:** A1'in %70'i tamamlanınca A2 açılır, A2'nin %70'i tamamlanınca B1.

**Neden:** Kullanıcının sıradaki seviyeye geçmek için yeterli kelime bilmesi gerekiyor.

---

## Reset: window.confirm yerine inline UI

**Karar:** Sıfırlama onayı için custom component, `window.confirm` değil.

**Neden:** Mobil tarayıcılar ve iframe'ler `window.confirm`'i engelliyor.

---

## Dil ekleme pipeline'ı

**Karar:** `lang:add → lang:translate → lang:audio → lang:register → lang:ship`

**Neden:** Her adım ayrı script, hepsi test edilmiş. Yeni dil eklemek tek komut: `npm run lang:add`.
