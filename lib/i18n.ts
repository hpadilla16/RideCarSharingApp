// App localization: English + Spanish (Puerto Rico market).
// Device language by default; user can override from the Account screen.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import es from '../locales/es.json';

const LANGUAGE_KEY = 'ride_language';

const deviceLanguage = getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

// Apply persisted manual override (if any) once storage resolves.
AsyncStorage.getItem(LANGUAGE_KEY)
  .then((saved) => {
    if (saved && saved !== i18n.language) i18n.changeLanguage(saved);
  })
  .catch(() => {});

export async function setLanguage(lang: 'en' | 'es'): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Non-fatal: preference just won't persist.
  }
}

export default i18n;
