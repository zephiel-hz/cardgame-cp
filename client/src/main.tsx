import { createRoot } from "react-dom/client";
import { I18nextProvider } from 'react-i18next';
import App from "./App";
import "./index.css";
import i18n from './lib/i18n';
import { LanguageProvider } from './context/LanguageContext';

// Set title immediately
document.title = 'Card Game Couple ❤️';

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found!");
}

createRoot(root).render(
  <I18nextProvider i18n={i18n}>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </I18nextProvider>
);
