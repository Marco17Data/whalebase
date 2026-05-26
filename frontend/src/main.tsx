import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './ThemeContext';
import './index.css';
import { AuthProvider } from './AuthContext';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
      {window.location.pathname === '/terms' ? <TermsPage /> :
       window.location.pathname === '/privacy' ? <PrivacyPage /> :
       <App />}
    </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
