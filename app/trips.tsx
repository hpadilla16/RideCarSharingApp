import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { api, readGuestSession } from '../lib/api';
import { fmtMoney, fmtDateTime } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#0fb0d8',
  ACTIVE: '#10b981',
  COMPLETED: '#6b7a9a',
  CANCELLED: '#ef4444',
  PENDING: '#f59e0b',
  PENDING_APPROVAL: '#f59e0b',
};

interface Booking {
  id?: string;
  reference?: string;
  reservationNumber?: string;
  tripCode?: string;
  status?: string;
  vehicleLabel?: string;
  pickupAt?: string;
  returnAt?: string;
  estimatedTotal?: number | string | null;
  agreementToken?: string | null;
  agreementSignedAt?: string | null;
  conversation?: { guestToken?: string } | null;
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function TripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  async function load() {
    const { token } = await readGuestSession();
    if (!token) {
      setLoggedIn(false);
      setLoading(false);
      return;
    }
    setLoggedIn(true);
    try {
      const data = await api<{ bookings?: Booking[] }>('/api/public/booking/guest-signin/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setBookings(data?.bookings || []);
      setError('');
    } catch (err) {
      setError(errMsg(err) || t('trips.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  if (!loggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{t('trips.signInTitle')}</Text>
        <Text style={styles.emptyText}>{t('trips.signInBody')}</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.signInBtnText}>{t('common.signIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.title}>{t('trips.title')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {bookings.length === 0 && !error && <Text style={styles.emptyText}>{t('trips.noTripsYet')}</Text>}
        {bookings.map((b, idx) => (
          <TouchableOpacity
            key={b.id || idx}
            style={styles.card}
            onPress={() => router.push(`/trip/${b.reference || b.reservationNumber || b.tripCode}`)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('trips.viewTripA11y', { reference: b.reference || b.reservationNumber || b.tripCode })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardRef}>{b.reference || b.reservationNumber || b.tripCode}</Text>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[b.status || ''] || colors.muted) + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[b.status || ''] || colors.muted }]}>
                  {(b.status || '').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.cardVehicle}>{b.vehicleLabel || t('trips.vehicle')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
              <View>
                <Text style={styles.label}>{t('trips.pickup')}</Text>
                <Text style={styles.cardDate}>{fmtDateTime(b.pickupAt)}</Text>
              </View>
              <View>
                <Text style={styles.label}>{t('trips.return')}</Text>
                <Text style={styles.cardDate}>{fmtDateTime(b.returnAt)}</Text>
              </View>
            </View>
            {b.estimatedTotal && <Text style={styles.cardTotal}>{fmtMoney(b.estimatedTotal)}</Text>}

            {/* Trip actions */}
            {(b.conversation?.guestToken || b.tripCode) && (
              <View style={styles.actionsRow}>
                {b.conversation?.guestToken && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/chat/${b.conversation?.guestToken}`)} accessibilityRole="button" accessibilityLabel={t('trips.chatA11y')}>
                    <Text style={styles.actionText}>{t('trips.chat')}</Text>
                  </TouchableOpacity>
                )}
                {b.tripCode && ['CONFIRMED', 'PENDING', 'PENDING_APPROVAL', 'RESERVED'].includes(b.status || '') && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/documents', params: { tripCode: b.tripCode } })} accessibilityRole="button" accessibilityLabel={t('trips.documentsA11y')}>
                    <Text style={styles.actionText}>{t('trips.documents')}</Text>
                  </TouchableOpacity>
                )}
                {b.tripCode && ['CONFIRMED', 'ACTIVE', 'IN_PROGRESS'].includes(b.status || '') && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/inspection', params: { tripCode: b.tripCode, phase: b.status === 'CONFIRMED' ? 'PICKUP' : 'RETURN' } })} accessibilityRole="button" accessibilityLabel={t('trips.inspectionA11y')}>
                    <Text style={styles.actionText}>{t('trips.inspection')}</Text>
                  </TouchableOpacity>
                )}
                {b.agreementToken && !b.agreementSignedAt && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/agreement', params: { token: b.agreementToken } })} accessibilityRole="button" accessibilityLabel={t('trips.signAgreementA11y')}>
                    <Text style={styles.actionText}>{t('trips.signAgreement')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
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
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  actionText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.ink },
});
