import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, readGuestSession } from '../../lib/api';
import { fmtMoney, fmtDateTime } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#0fb0d8',
  ACTIVE: '#10b981',
  COMPLETED: '#6b7a9a',
  CANCELLED: '#ef4444',
  PENDING: '#f59e0b',
  PENDING_APPROVAL: '#f59e0b',
};

const CANCELLABLE_STATUSES = ['CONFIRMED', 'PENDING', 'PENDING_APPROVAL', 'RESERVED'];

interface BookingHost {
  id?: string;
  displayName?: string;
  averageRating?: number | string | null;
  reviewCount?: number | null;
  [key: string]: unknown;
}

interface Booking {
  id?: string;
  reference?: string;
  reservationNumber?: string;
  tripCode?: string;
  status?: string;
  vehicleLabel?: string;
  pickupAt?: string;
  returnAt?: string;
  pickupLocationName?: string;
  estimatedTotal?: number | string | null;
  agreementToken?: string | null;
  agreementSignedAt?: string | null;
  host?: BookingHost | null;
  conversation?: { guestToken?: string } | null;
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function TripDetailScreen() {
  const { t } = useTranslation();
  const { reference } = useLocalSearchParams<{ reference?: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function load() {
    setError('');
    try {
      const { token } = await readGuestSession();
      if (!token) {
        setError(t('tripDetail.signInRequired'));
        setLoading(false);
        return;
      }
      const data = await api<{ bookings?: Booking[] }>('/api/public/booking/guest-signin/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      const list = data?.bookings || [];
      const found =
        list.find((b) => b.reference === reference) ||
        list.find((b) => b.reservationNumber === reference) ||
        list.find((b) => b.tripCode === reference) ||
        null;
      if (!found) setError(t('tripDetail.notFound'));
      setBooking(found);
    } catch (err) {
      logError(err, { screen: 'trip/[reference]', reference });
      setError(errMsg(err) || t('tripDetail.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reference]);

  async function doCancel() {
    if (!booking?.tripCode) return;
    setCancelling(true);
    setError('');
    try {
      const { customer } = await readGuestSession();
      await api(`/api/public/booking/trips/${encodeURIComponent(booking.tripCode)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ email: customer?.email || '' }),
      });
      await load();
    } catch (err) {
      logError(err, { screen: 'trip/[reference]', reference, action: 'cancel' });
      setError(errMsg(err) || t('tripDetail.unableToCancel'));
    } finally {
      setCancelling(false);
    }
  }

  function confirmCancel() {
    Alert.alert(t('tripDetail.cancelConfirmTitle'), t('tripDetail.cancelConfirmBody'), [
      { text: t('tripDetail.keepTrip'), style: 'cancel' },
      { text: t('tripDetail.cancelTrip'), style: 'destructive', onPress: doCancel },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('tripDetail.notFound')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = booking.status || '';
  const statusColor = STATUS_COLORS[status] || colors.muted;
  const hostRating = Number(booking.host?.averageRating);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>{booking.vehicleLabel || t('trips.vehicle')}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{status.replace(/_/g, ' ')}</Text>
        </View>
      </View>
      <Text style={styles.reference}>{booking.reference || booking.reservationNumber || booking.tripCode}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('trips.pickup')}</Text>
            <Text style={styles.value}>{fmtDateTime(booking.pickupAt)}</Text>
            {booking.pickupLocationName ? <Text style={styles.subValue}>{booking.pickupLocationName}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('trips.return')}</Text>
            <Text style={styles.value}>{fmtDateTime(booking.returnAt)}</Text>
          </View>
        </View>
        {booking.host?.displayName ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>{t('tripDetail.host')}</Text>
            <Text style={styles.value}>
              {booking.host.displayName}
              {hostRating > 0 ? ` · ★ ${hostRating.toFixed(1)}` : ''}
              {booking.host.reviewCount ? ` (${booking.host.reviewCount})` : ''}
            </Text>
          </View>
        ) : null}
        {booking.estimatedTotal ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>{t('tripDetail.estimatedTotal')}</Text>
            <Text style={styles.total}>{fmtMoney(booking.estimatedTotal)}</Text>
          </View>
        ) : null}
        {booking.tripCode ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>{t('tripDetail.tripCode')}</Text>
            <Text style={styles.value}>{booking.tripCode}</Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <Text style={styles.sectionTitle}>{t('tripDetail.actions')}</Text>
      <View style={styles.actionsRow}>
        {booking.conversation?.guestToken && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/chat/${booking.conversation?.guestToken}`)} accessibilityRole="button" accessibilityLabel={t('trips.chatA11y')}>
            <Text style={styles.actionText}>{t('trips.chat')}</Text>
          </TouchableOpacity>
        )}
        {booking.tripCode && ['CONFIRMED', 'PENDING', 'PENDING_APPROVAL', 'RESERVED'].includes(status) && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/documents', params: { tripCode: booking.tripCode } })} accessibilityRole="button" accessibilityLabel={t('trips.documentsA11y')}>
            <Text style={styles.actionText}>{t('trips.documents')}</Text>
          </TouchableOpacity>
        )}
        {booking.tripCode && ['CONFIRMED', 'ACTIVE', 'IN_PROGRESS'].includes(status) && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/inspection', params: { tripCode: booking.tripCode, phase: status === 'CONFIRMED' ? 'PICKUP' : 'RETURN' } })} accessibilityRole="button" accessibilityLabel={t('trips.inspectionA11y')}>
            <Text style={styles.actionText}>{t('trips.inspection')}</Text>
          </TouchableOpacity>
        )}
        {booking.agreementToken && !booking.agreementSignedAt && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/agreement', params: { token: booking.agreementToken } })} accessibilityRole="button" accessibilityLabel={t('trips.signAgreementA11y')}>
            <Text style={styles.actionText}>{t('trips.signAgreement')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {booking.agreementSignedAt ? <Text style={styles.signedNote}>{t('tripDetail.agreementSigned')}</Text> : null}

      {/* Cancel */}
      {booking.tripCode && CANCELLABLE_STATUSES.includes(status) && (
        <TouchableOpacity
          style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
          onPress={confirmCancel}
          disabled={cancelling}
          accessibilityRole="button"
          accessibilityLabel={t('tripDetail.cancelA11y')}
        >
          <Text style={styles.cancelBtnText}>{cancelling ? t('tripDetail.cancelling') : t('tripDetail.cancelTrip')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{t('common.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, flex: 1, marginRight: spacing.sm },
  reference: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md, textAlign: 'center' },
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.lg },
  label: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: fontSize.sm, color: colors.ink, fontWeight: '600' },
  subValue: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
  total: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  actionText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.ink },
  signedNote: { color: colors.success, fontWeight: '700', fontSize: fontSize.sm, marginTop: spacing.sm },
  cancelBtn: { height: 52, borderRadius: 14, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  cancelBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  btn: { height: 48, paddingHorizontal: 32, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
