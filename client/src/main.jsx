import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './style.css';

// GitHub Pages is a static file host with no server-side rewrite, so a
// BrowserRouter path like /status would 404 on refresh or direct link.
// HashRouter keeps all routing client-side (/#/status) and needs nothing
// special from the host.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
