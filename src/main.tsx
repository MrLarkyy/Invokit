import '@fontsource-variable/baloo-2/wght.css';
import '@fontsource-variable/nunito/wght.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/tokens.css';
import './ui/styles/app.css';
import { App } from './ui/App';
import './pwa/updatePrompt.css';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { startServiceWorker } from './pwa/updateStore';

const root = document.getElementById('root');
if (root) {
  // The worker is built only for production; dev and tests never register it.
  const updates = import.meta.env.PROD ? startServiceWorker() : null;
  createRoot(root).render(
    <StrictMode>
      <App />
      {updates && <UpdatePrompt store={updates} />}
    </StrictMode>,
  );
}
