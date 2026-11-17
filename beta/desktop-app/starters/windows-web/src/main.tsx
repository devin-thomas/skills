import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import config from '../app.config.json';
import { App } from './App';
import { bootstrap, bridge } from './bridge';
import { installWindowTracking } from './state/modality';
import { configureStorage } from './state/storage';
import './styles/app.css';

installWindowTracking();
document.title = config.productName;

// Everything the first screen needs is ready before the first paint, so there
// is no loading state to flash.
const boot = await bootstrap();
configureStorage(bridge?.saveState, boot.stored);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App boot={boot} />
  </StrictMode>,
);
