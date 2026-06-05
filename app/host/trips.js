import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { hostApi, readHostSession } from '../../lib/hostApi';
import { fmtMoney, fmtDateTime } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';

export default function HostTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { token } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      try {
        const data = await hostApi('/dashboard');
        setTrips(data?.trips || []);
      } catch (err) {
        logError(err, { screen: 'host/trips' });
        setMsg('Unable to load trips. Try again later.');
      } finally { setLoading(false); }
    })();
  }, []);

  async function updateStatus(tripId, status) {
    try {
      await hostApi(`/trips/${tripId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Trip ${status.toLowerCase()}`);
      const data = await hostApi('/dashboard');
      setTrips(data?.trips || []);
    } catch (err) { setMsg(err.message); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to dashboard"><Text style={{ color: colors.brand, fontWeight: '600', marginBottom: spacing.md }}>← Dashboard</Text></TouchableOpacity>
      <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.lg }}>My Trips</Text>
      {msg ? <Text style={{ color: colors.muted, marginBottom: spacing.md }}>{msg}</Text> : null}
      {trips.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{t.tripCode || t.id?.slice(0, 8)}</Text>
            <Text style={{ fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', color: colors.muted }}>{(t.status || '').replace(/_/g, ' ')}</Text>
          </View>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginTop: 2 }}>
            {t.guest ? `${t.guest.firstName || ''} ${t.guest.lastName || ''}` : ''}{t.listing?.title ? ` · ${t.listing.title}` : ''}
          </Text>
          {t.scheduledPickupAt && <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>Pickup: {fmtDateTime(t.scheduledPickupAt)}</Text>}
          {t.totalPrice != null && <Text style={{ fontWeight: '700', color: colors.brand, marginTop: 4 }}>{fmtMoney(t.totalPrice)}</Text>}
          {t.status === 'PENDING_APPROVAL' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(80,200,120,.15)' }]} onPress={() => updateStatus(t.id, 'CONFIRMED')} accessibilityRole="button" accessibilityLabel={`Approve trip ${t.tripCode || ''}`}><Text style={{ color: colors.success, fontWeight: '700', fontSize: fontSize.xs }}>Approve</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,80,80,.1)' }]} onPress={() => updateStatus(t.id, 'CANCELLED')} accessibilityRole="button" accessibilityLabel={`Decline trip ${t.tripCode || ''}`}><Text style={{ color: colors.error, fontWeight: '700', fontSize: fontSize.xs }}>Decline</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {!loading && !trips.length && <Text style={{ color: colors.muted }}>No trips yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
  actionBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8 },
});
