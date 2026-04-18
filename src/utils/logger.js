// Kara kutu logger — her önemli işlemi localStorage'a yazar
// Son 100 kayıt tutulur, eskiler silinir
// Kategoriler: progress | achievement | streak | error | system

const MAX_ENTRIES = 100;
const STORAGE_KEY = 'verbyte_log';

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage dolu olabilir, sessizce geç
  }
}

export const logger = {
  // INPUT:  category: string, message: string, data?: any
  // EFFECT: localStorage'a yazar, MAX_ENTRIES aşılınca eskiyi siler
  log(category, message, data) {
    const entries = load();
    const entry = { ts: timestamp(), cat: category, msg: message };
    if (data !== undefined) entry.data = data;
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    save(entries);
  },

  // Tüm kayıtları döndür
  read() {
    return load();
  },

  // Son N kaydı döndür
  tail(n = 20) {
    const entries = load();
    return entries.slice(-n);
  },

  // Kayıtları temizle
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
