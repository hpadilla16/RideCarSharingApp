import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { hostApi, readHostSession, clearHostSession } from '../../lib/hostApi';
import { fmtMoney } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';

export default function HostDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { token, user: u } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      setUser(u);
      try {
        const data = await hostApi('/dashboard');
        setDashboard(data);
      } catch (err) {
        if (err.status === 401) { router.replace('/host/login'); return; }
        setError(err.message);
      } finally { setLoading(false); }
    })();
  }, []);

  async function handleLogout() {
    await clearHostSession();
    router.replace('/host/login');
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  const profile = dashboard?.hostProfile;
  const metrics = dashboard?.metrics || {};
  const listings = dashboard?.listings || [];
  const trips = dashboard?.trips || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <View>
          <Text style={styles.title}>{profile?.displayName || user?.fullName || 'Host'}</Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.sm }}>{profile?.email || ''}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}><Text style={{ color: colors.error, fontWeight: '600' }}>Logout</Text></TouchableOpacity>
      </View>

      {error ? <Text style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Text> : null}

      {/* Metrics */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {[
          { label: 'Listings', value: metrics.publishedListings ?? listings.length },
          { label: 'Trips', value: metrics.totalTrips ?? trips.length },
          { label: 'Active', value: metrics.activeTrips ?? 0 },
          { label: 'Rating', value: profile?.averageRating ? Number(profile.averageRating).toFixed(1) : '—' },
        ].map((m) => (
          <View key={m.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Nav */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/host/listings')}><Text style={styles.navBtnText}>My Listings</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/host/trips')}><Text style={styles.navBtnText}>Trips</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/host/earnings')}><Text style={styles.navBtnText}>Earnings</Text></TouchableOpacity>
      </View>

      {/* Recent Listings */}
      <Text style={styles.sectionTitle}>Your Listings</Text>
      {listings.slice(0, 4).map((l) => (
        <View key={l.id} style={styles.card}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{l.title || 'Untitled'}</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{l.vehicle ? `${l.vehicle.year} ${l.vehicle.make} ${l.vehicle.model}` : ''}{l.baseDailyRate ? ` · ${fmtMoney(l.baseDailyRate)}/day` : ''}</Text>
        </View>
      ))}
      {!listings.length && <Text style={{ color: colors.muted }}>No listings yet</Text>}

      {/* Recent Trips */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Recent Trips</Text>
      {trips.slice(0, 5).map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>{t.tripCode || t.id?.slice(0, 8)}</Text>
            <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' }}>{(t.status || '').replace(/_/g, ' ')}</Text>
          </View>
        </View>
      ))}
      {!trips.length && <Text style={{ color: colors.muted }}>No trips yet</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  metricCard: { flex: 1, minWidth: 70, padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, alignItems: 'center', elevation: 1 },
  metricValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.brand },
  metricLabel: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', marginTop: 2 },
  navBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.brand },
  navBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
});
