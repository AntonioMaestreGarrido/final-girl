import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/creepster';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
