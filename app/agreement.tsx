import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, type ApiError } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';
import { logError } from '../lib/logger';
import { useTranslation } from 'react-i18next';

interface Agreement {
  agreementToken?: string;
  tripCode?: string;
  reservationNumber?: string;
  signedAt?: string | null;
  signedBy?: string | null;
  customerName?: string;
  vehicleLabel?: string;
  pickupAt?: string;
  returnAt?: string;
  pickupLocationName?: string;
  returnLocationName?: string;
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function AgreementScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [typedName, setTypedName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function load() {
    if (!token) {
      setError(t('agreement.missingToken'));
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await api<Agreement>(`/api/public/booking/rental-agreements/${encodeURIComponent(token)}`);
      setAgreement(data);
    } catch (err) {
      logError(err, { screen: 'agreement' });
      const status = (err as ApiError)?.status;
      setError(status === 404 ? t('agreement.invalidOrExpired') : errMsg(err) || t('agreement.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function submit() {
    const name = typedName.trim();
    if (name.length < 3) {
      setError(t('agreement.nameTooShort'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await api<Agreement>(`/api/public/booking/rental-agreements/${encodeURIComponent(token || '')}/signature`, {
        method: 'POST',
        body: JSON.stringify({ typedName: name }),
      });
      setAgreement(updated);
    } catch (err) {
      logError(err, { screen: 'agreement', action: 'signature' });
      const status = (err as ApiError)?.status;
      if (status === 409) {
        setError(t('agreement.alreadySigned'));
        load();
      } else {
        setError(errMsg(err) || t('agreement.unableToSubmit'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  if (!agreement) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('agreement.unableToLoad')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('agreement.title')}</Text>
      {agreement.reservationNumber ? <Text style={styles.reference}>{t('agreement.reservation', { number: agreement.reservationNumber })}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.vehicle}>{agreement.vehicleLabel || t('trips.vehicle')}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('trips.pickup')}</Text>
            <Text style={styles.value}>{fmtDateTime(agreement.pickupAt)}</Text>
            {agreement.pickupLocationName ? <Text style={styles.subValue}>{agreement.pickupLocationName}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('trips.return')}</Text>
            <Text style={styles.value}>{fmtDateTime(agreement.returnAt)}</Text>
            {agreement.returnLocationName ? <Text style={styles.subValue}>{agreement.returnLocationName}</Text> : null}
          </View>
        </View>
      </View>

      {agreement.signedAt ? (
        <View style={styles.signedCard}>
          <Text style={styles.signedTitle}>{t('agreement.signedTitle')}</Text>
          <Text style={styles.signedBody}>
            {t('agreement.signedBy', { name: agreement.signedBy || agreement.customerName, date: fmtDateTime(agreement.signedAt) })}
          </Text>
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>{t('agreement.signatureSection')}</Text>
          <Text style={styles.legalNote}>{t('agreement.legalNote')}</Text>
          <TextInput
            style={styles.input}
            value={typedName}
            onChangeText={setTypedName}
            placeholder={t('agreement.typedNamePlaceholder')}
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            accessibilityLabel={t('agreement.typedNameA11y')}
          />
          <TouchableOpacity
            style={[styles.btn, (typedName.trim().length < 3 || submitting) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={typedName.trim().length < 3 || submitting}
            accessibilityRole="button"
            accessibilityLabel={t('agreement.submitA11y')}
          >
            <Text style={styles.btnText}>{submitting ? t('agreement.submitting') : t('agreement.signNow')}</Text>
          </TouchableOpacity>
        </View>
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
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  reference: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.error, marginVertical: spacing.sm, textAlign: 'center' },
  card: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  vehicle: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.lg },
  label: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: fontSize.sm, color: colors.ink, fontWeight: '600' },
  subValue: { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },
  signedCard: { padding: spacing.md, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  signedTitle: { color: '#10b981', fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.xs },
  signedBody: { color: colors.ink, fontSize: fontSize.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  legalNote: { fontSize: fontSize.xs, color: colors.muted, lineHeight: 18, marginBottom: spacing.md },
  input: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md, backgroundColor: colors.card, color: colors.ink, marginBottom: spacing.md },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
