import { createContext, useContext, useState } from 'react';
import storage from './storage';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true); // varsayılan dark

  // AsyncStorage'dan oku
  // storage.getJSON('verbyte_theme').then(t => { if (t !== null) setDark(t); });

  function toggle() {
    const next = !dark;
    setDark(next);
    storage.setJSON('verbyte_theme', next);
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
