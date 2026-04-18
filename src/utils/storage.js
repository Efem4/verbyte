/**
 * AsyncStorage wrapper — web'deki localStorage API'siyle birebir aynı kullanım.
 * Tek fark: async/await gerekiyor.
 *
 * Kullanım:
 *   import storage from '../utils/storage';
 *   await storage.setItem('key', JSON.stringify(data));
 *   const raw = await storage.getItem('key');
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = {
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },

  // JSON helpers — localStorage'daki JSON.parse/stringify kalıbını kısaltır
  async getJSON(key, fallback = null) {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  async setJSON(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

export default storage;
