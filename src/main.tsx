import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The interface typeface is bundled with the game (SIL Open Font License), so it works offline.
import '@fontsource-variable/exo-2/wght.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
