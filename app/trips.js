import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { api, readGuestSession } from '../lib/api';
import { fmtMoney, fmtDateTime } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';

const STATUS_COLORS = {
  CONFIRMED: '#0fb0d8',
  ACTIVE: '#10b981',
  COMPLETED: '#6b7a9a',
  CANCELLED: '#ef4444',
  PENDING: '#f59e0b',
  PENDING_APPROVAL: '#f59e0b',
};

export default function TripsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { token } = await readGuestSession();
      if (!token) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      try {
        const data = await api('/api/public/booking/guest-signin/verify', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setBookings(data?.bookings || []);
      } catch (err) {
        setError(err?.message || 'Unable to load trips');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  if (!loggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see your trips</Text>
        <Text style={styles.emptyText}>Your bookings will appear here after you sign in.</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login')}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>My Trips</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {bookings.length === 0 && !error && <Text style={styles.emptyText}>No trips yet.</Text>}
        {bookings.map((b, idx) => (
          <View key={b.id || idx} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardRef}>{b.reference || b.reservationNumber || b.tripCode}</Text>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[b.status] || colors.muted) + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] || colors.muted }]}>
                  {(b.status || '').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.cardVehicle}>{b.vehicleLabel || 'Vehicle'}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
              <View>
                <Text style={styles.label}>Pickup</Text>
                <Text style={styles.cardDate}>{fmtDateTime(b.pickupAt)}</Text>
              </View>
              <View>
                <Text style={styles.label}>Return</Text>
                <Text style={styles.cardDate}>{fmtDateTime(b.returnAt)}</Text>
              </View>
            </View>
            {b.estimatedTotal && <Text style={styles.cardTotal}>{fmtMoney(b.estimatedTotal)}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.lg },
  error: { color: colors.error, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  signInBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, backgroundColor: colors.brand },
  signInBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, marginBottom: spacing.md, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardRef: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md },
  cardVehicle: { fontSize: fontSize.sm, color: colors.muted, marginTop: 4 },
  cardDate: { fontSize: fontSize.sm, color: colors.ink },
  cardTotal: { fontSize: fontSize.md, fontWeight: '800', color: colors.brand, marginTop: spacing.sm },
  label: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
});
