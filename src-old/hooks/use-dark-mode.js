import { useState, useEffect, useCallback } from "react";

/**
 * Manages dark / light mode.
 * - Persists the preference in localStorage under "chess-dark-mode"
 * - Applies / removes the `dark` CSS class on <html>
 * - Defaults to dark mode if no preference has been saved
 */
const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("chess-dark-mode");
    // Saved preference wins; first visit defaults to dark
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("chess-dark-mode", String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((previous) => !previous);
  }, []);

  return { isDarkMode, toggleDarkMode };
};

export default useDarkMode;
