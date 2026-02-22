import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { HashRouter, Routes } from "react-router-dom";
import { renderRoutes } from "./routes";
import { LoadingScreen } from "./components/common/LoadingScreen";
import './index.css';

import { ThemeProvider } from "./hooks/theme-provider";

const App = () => {
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    window.api.checkEnvironment().then((ready) => {
      if (ready) {
        setIsReady(true);
      }
      setIsChecking(false);
    });
  }, []);

  if (isChecking) {
    return null; // Brief blank while checking
  }

  if (!isReady) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <LoadingScreen onReady={() => setIsReady(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <HashRouter>
        <Routes>
          {renderRoutes()}
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);