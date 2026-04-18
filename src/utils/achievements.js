export const ACHIEVEMENTS = [
  // Streak
  { id: 'streak_7',    category: 'streak',   icon: '🔥', label: 'Haftalık Savaşçı',    desc: '7 gün üst üste çalış' },
  { id: 'streak_14',   category: 'streak',   icon: '🔥', label: 'İki Hafta Azmi',      desc: '14 gün üst üste çalış' },
  { id: 'streak_30',   category: 'streak',   icon: '🔥', label: 'Aylık Demir',         desc: '30 gün üst üste çalış' },
  { id: 'streak_60',   category: 'streak',   icon: '🏆', label: 'Usta',                desc: '60 gün üst üste çalış' },
  // Combo
  { id: 'combo_5',     category: 'combo',    icon: '⚡', label: 'Isındım',             desc: '5 kartı üst üste doğru bil' },
  { id: 'combo_10',    category: 'combo',    icon: '⚡', label: 'Durdurulamaz',        desc: '10 kartı üst üste doğru bil' },
  { id: 'combo_20',    category: 'combo',    icon: '⚡', label: 'Makine',              desc: '20 kartı üst üste doğru bil' },
  // Words
  { id: 'words_10',    category: 'words',    icon: '📚', label: 'İlk Adım',           desc: '10 kelime öğren' },
  { id: 'words_50',    category: 'words',    icon: '📚', label: 'Kelime Avcısı',      desc: '50 kelime öğren' },
  { id: 'words_100',   category: 'words',    icon: '📚', label: 'Sözlük',             desc: '100 kelime öğren' },
  // Mastery
  { id: 'mastered_1',  category: 'mastery',  icon: '⭐', label: 'İlk Hafıza',         desc: '1 kelimeyi ustalaş' },
  { id: 'mastered_20', category: 'mastery',  icon: '⭐', label: 'Beyin Kasları',      desc: '20 kelimeyi ustalaş' },
  { id: 'mastered_50', category: 'mastery',  icon: '⭐', label: 'Gerçek Öğrenme',     desc: '50 kelimeyi ustalaş' },
];

// INPUT:  earned: Set<string>, params: { streak, combo, totalWords, mastered }
// OUTPUT: Achievement[] — yeni kazanılan rozetler (already earned olanlar hariç)
// EFFECT: localStorage'a dokunmaz
export function checkNew(earned, { streak, combo, totalWords, mastered }) {
  return ACHIEVEMENTS.filter((a) => {
    if (earned.has(a.id)) return false;
    if (a.category === 'streak')  return streak     >= Number(a.id.split('_')[1]);
    if (a.category === 'combo')   return combo      >= Number(a.id.split('_')[1]);
    if (a.category === 'words')   return totalWords >= Number(a.id.split('_')[1]);
    if (a.category === 'mastery') return mastered   >= Number(a.id.split('_')[1]);
    return false;
  });
}

export function loadEarned() {
  try {
    return new Set(JSON.parse(localStorage.getItem('verbyte_achievements') || '[]'));
  } catch {
    return new Set();
  }
}

export function saveEarned(set) {
  localStorage.setItem('verbyte_achievements', JSON.stringify([...set]));
}
