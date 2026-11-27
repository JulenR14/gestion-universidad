import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { requestPersistence } from './db';
import { preloadGoogle } from './lib/google-auth';
import { startAutoSync } from './lib/sync';
import './styles.css';

requestPersistence();
preloadGoogle();
startAutoSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
