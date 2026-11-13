import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import hi from './hi.json';
import { setMoneyLanguage } from '../lib/money';

/**
 * UI chrome strings only. Business labels (stages, intents, outcomes, glossary terms)
 * come from GET /config/app so Ops can change them without an app release.
 */
export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

function deviceLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

const i18n = createInstance();
i18n.on('languageChanged', (l) => setMoneyLanguage(l));

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    lng: deviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  setMoneyLanguage(i18n.language);
}

export function setLanguage(lang: string | null | undefined) {
  const l: Language = lang === 'hi' ? 'hi' : 'en';
  if (i18n.language !== l) void i18n.changeLanguage(l);
}

export function useT() {
  return useTranslation().t;
}

export default i18n;
