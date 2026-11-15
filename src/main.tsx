import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Typefaces are bundled with the game (SIL Open Font License), so it works offline.
// Space Grotesk for headings, JetBrains Mono for labels and telemetry. Exo 2 is
// still drawn into the 3D Crew Ship room lettering.
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/exo-2/wght.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
