import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './ThemeContext';
import './index.css';
import { AuthProvider } from './AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
      <App />
    </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
