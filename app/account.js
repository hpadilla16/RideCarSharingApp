import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Switch } from 'react-native';
import { readGuestSession, clearGuestSession } from '../lib/api';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from '../lib/biometric';
import { colors, spacing, fontSize } from '../lib/theme';

export default function AccountScreen() {
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
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Sign in to manage your bookings, messages, and reviews.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer?.firstName || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{[customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Guest'}</Text>
        <Text style={styles.email}>{customer?.email || ''}</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trips')} accessibilityRole="button">
          <Text style={styles.menuText}>My Trips</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.menuText}>Messages</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}} accessibilityRole="button">
          <Text style={styles.menuText}>Reviews</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/issue')} accessibilityRole="button">
          <Text style={styles.menuText}>Report an Issue</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/inspection')} accessibilityRole="button">
          <Text style={styles.menuText}>Vehicle Inspection</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
        {bioAvailable && (
          <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
            <Text style={styles.menuText}>Biometric Login</Text>
            <Switch
              value={bioEnabled}
              onValueChange={async (val) => { await setBiometricEnabled(val); setBioEnabled(val); }}
              trackColor={{ true: colors.brand }}
            />
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
        <Text style={styles.logoutText}>Sign Out</Text>
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
});
