import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { hostApi, readHostSession } from '../../lib/hostApi';
import { fmtMoney, fmtDateTime } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';
import { useTranslation } from 'react-i18next';

export default function HostEarningsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { token } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      try { setDashboard(await hostApi('/dashboard')); } catch (err) { logError(err, { screen: 'host/earnings' }); } finally { setLoading(false); }
    })();
  }, []);

  const trips = dashboard?.trips || [];
  const completed = trips.filter((t) => t.status === 'COMPLETED');
  const totalEarned = completed.reduce((s, t) => s + Number(t.hostPayout || t.totalPrice || 0), 0);
  const pending = trips.filter((t) => ['CONFIRMED', 'ACTIVE'].includes(t.status));
  const pendingAmount = pending.reduce((s, t) => s + Number(t.hostPayout || t.totalPrice || 0), 0);
  const profile = dashboard?.hostProfile;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text onPress={() => router.back()} style={{ color: colors.brand, fontWeight: '600', marginBottom: spacing.md }}>{t('hostEarnings.backToDashboard')}</Text>
      <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.lg }}>{t('hostEarnings.title')}</Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <View style={[styles.sumCard, { flex: 1 }]}>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' }}>{t('hostEarnings.totalEarned')}</Text>
          <Text style={{ fontSize: fontSize.xxl, fontWeight: '800', color: colors.success }}>{fmtMoney(totalEarned)}</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{t('hostEarnings.tripCount', { count: completed.length })}</Text>
        </View>
        <View style={[styles.sumCard, { flex: 1 }]}>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' }}>{t('hostEarnings.pending')}</Text>
          <Text style={{ fontSize: fontSize.xxl, fontWeight: '800', color: colors.warning }}>{fmtMoney(pendingAmount)}</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{t('hostEarnings.tripCount', { count: pending.length })}</Text>
        </View>
      </View>

      <View style={styles.sumCard}>
        <Text style={{ fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' }}>{t('hostEarnings.payoutStatus')}</Text>
        <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: profile?.payoutEnabled ? colors.success : colors.error, marginTop: 4 }}>
          {profile?.payoutEnabled ? t('hostEarnings.enabled') : t('hostEarnings.notConfigured')}
        </Text>
      </View>

      <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('hostEarnings.history')}</Text>
      {completed.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>{t.tripCode}{t.guest ? ` · ${t.guest.firstName}` : ''}</Text>
            <Text style={{ fontWeight: '800', color: colors.success }}>{fmtMoney(t.hostPayout || t.totalPrice)}</Text>
          </View>
          <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{t.listing?.title}{t.scheduledReturnAt ? ` · ${fmtDateTime(t.scheduledReturnAt)}` : ''}</Text>
        </View>
      ))}
      {!completed.length && <Text style={{ color: colors.muted }}>{t('hostEarnings.noCompletedTrips')}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sumCard: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, elevation: 1, marginBottom: spacing.sm, alignItems: 'center' },
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
});
