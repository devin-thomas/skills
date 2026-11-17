import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import config from '../app.config.json';
import { App } from './App';
import { boot, desktop, platform } from './desktop';
import { startJobs } from './state/job';
import { installWindowTracking } from './state/modality';
import { setShortcutPlatform } from './state/shortcuts';
import { configureStorage } from './state/storage';
import './styles/app.css';

installWindowTracking();
document.title = config.productName;
// The stylesheet reads this for the title bar's inset and nothing else; the
// shortcut labels read it through setShortcutPlatform.
document.documentElement.dataset.platform = platform;
setShortcutPlatform(platform);

// Everything the first screen needs is ready before the first paint, so there
// is no loading state to flash: saved work, the system and the tool's status.
configureStorage(desktop.saveState.bind(desktop), boot.stored);
startJobs(desktop, boot.tool);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App boot={boot} desktop={desktop} platform={platform} />
  </StrictMode>,
);
