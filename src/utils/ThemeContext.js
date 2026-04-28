import { createContext, useContext, useState, useEffect } from 'react';
import storage from './storage';
import { colors, makeStyles } from '../tokens/verbyte.tokens';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true); // varsayılan dark

  useEffect(() => {
    storage.getJSON('verbyte_theme').then(val => {
      if (val !== null) setDark(val);
    });
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    storage.setJSON('verbyte_theme', next);
  }

  const theme = dark ? 'dark' : 'light';
  const c = colors[theme];
  const styles = makeStyles(theme);

  return (
    <ThemeContext.Provider value={{ dark, theme, c, styles, colors, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
