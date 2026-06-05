import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Switch } from 'react-native';
import { readGuestSession, clearGuestSession } from '../lib/api';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from '../lib/biometric';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../lib/i18n';

function LanguageSelector() {
  const { t, i18n } = useTranslation();
  return (
    <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
      <Text style={styles.menuText}>{t('common.language')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {[
          { code: 'en', label: t('common.english') },
          { code: 'es', label: t('common.spanish') },
        ].map((lang) => (
          <TouchableOpacity
            key={lang.code}
            onPress={() => setLanguage(lang.code)}
            style={[styles.langBtn, i18n.language === lang.code && styles.langBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={lang.label}
            accessibilityState={{ selected: i18n.language === lang.code }}
          >
            <Text style={[styles.langText, i18n.language === lang.code && styles.langTextActive]}>{lang.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { token, customer: c } = await readGuestSession();
      setLoggedIn(!!token);
      setCustomer(c);
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isBiometricEnabled());
    })();
  }, []);

  async function handleLogout() {
    await clearGuestSession();
    setLoggedIn(false);
    setCustomer(null);
  }

  if (!loggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('account.title')}</Text>
        <Text style={styles.subtitle}>{t('account.signInPrompt')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.signIn')}</Text>
        </TouchableOpacity>
        <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
          <LanguageSelector />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer?.firstName || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{[customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || t('account.guest')}</Text>
        <Text style={styles.email}>{customer?.email || ''}</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trips')} accessibilityRole="button">
          <Text style={styles.menuText}>{t('account.myTrips')}</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.menuText}>{t('account.messages')}</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.menuText}>{t('account.reviews')}</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/issue')} accessibilityRole="button">
          <Text style={styles.menuText}>{t('account.reportIssue')}</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/inspection')} accessibilityRole="button">
          <Text style={styles.menuText}>{t('account.vehicleInspection')}</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <LanguageSelector />
        {bioAvailable && (
          <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
            <Text style={styles.menuText}>{t('account.biometricLogin')}</Text>
            <Switch
              value={bioEnabled}
              onValueChange={async (val) => { await setBiometricEnabled(val); setBioEnabled(val); }}
              trackColor={{ true: colors.brand }}
            />
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
        <Text style={styles.logoutText}>{t('common.signOut')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  btn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, backgroundColor: colors.brand },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: fontSize.xxl },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  email: { fontSize: fontSize.sm, color: colors.muted, marginTop: 4 },
  menu: { gap: 2 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm },
  menuText: { fontSize: fontSize.md, fontWeight: '600', color: colors.ink },
  menuArrow: { fontSize: fontSize.md, color: colors.muted },
  logoutBtn: { marginTop: spacing.xl, alignItems: 'center', padding: spacing.md },
  logoutText: { color: colors.error, fontWeight: '600', fontSize: fontSize.md },
  langBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  langBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted },
  langTextActive: { color: colors.white },
});
