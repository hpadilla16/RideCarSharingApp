import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { logError } from '../lib/logger';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

const DOC_TYPES = [
  { type: 'LICENSE', field: 'license' },
  { type: 'INSURANCE', field: 'insurance' },
];

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
};

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const { tripCode } = useLocalSearchParams();
  const router = useRouter();
  const [state, setState] = useState(null); // { documents, tripStatus }
  const [captures, setCaptures] = useState({}); // field -> { uri, dataUrl }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const docsPath = `/api/public/booking/trips/${encodeURIComponent(tripCode || '')}/documents`;

  async function load() {
    if (!tripCode) { setError(t('documents.missingTrip')); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      setState(await api(docsPath));
    } catch (err) {
      logError(err, { screen: 'documents', tripCode });
      setError(err?.message || t('documents.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripCode]);

  function docFor(type) {
    return (state?.documents || []).find((d) => d.type === type) || null;
  }

  async function capture(field, fromCamera) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const opts = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false, base64: true };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets?.[0]?.base64) {
      const a = result.assets[0];
      setCaptures((c) => ({
        ...c,
        [field]: { uri: a.uri, dataUrl: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` },
      }));
    }
  }

  async function submit() {
    const body = {};
    for (const { field } of DOC_TYPES) {
      if (captures[field]?.dataUrl) body[field] = captures[field].dataUrl;
    }
    if (!Object.keys(body).length) return;
    setSubmitting(true);
    setError('');
    try {
      setState(await api(docsPath, { method: 'POST', body: JSON.stringify(body) }));
      setCaptures({});
    } catch (err) {
      logError(err, { screen: 'documents', tripCode });
      setError(err?.message || t('documents.uploadFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  if (error && !state) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={load} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allApproved = DOC_TYPES.every(({ type }) => docFor(type)?.status === 'APPROVED');
  const hasPendingCapture = DOC_TYPES.some(({ field }) => captures[field]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{t('documents.title')}</Text>
      <Text style={styles.subtitle}>{t('documents.subtitle')}</Text>
      {tripCode ? <Text style={styles.tripCode}>{t('documents.trip', { tripCode })}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {allApproved && (
        <View style={styles.approvedBanner}>
          <Text style={styles.approvedText}>{t('documents.allApproved')}</Text>
        </View>
      )}

      {DOC_TYPES.map(({ type, field }) => {
        const doc = docFor(type);
        const cap = captures[field];
        const status = doc?.status;
        return (
          <View key={type} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t(`documents.type_${field}`)}</Text>
              {status && (
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[status] || colors.muted) + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[status] || colors.muted }]}>
                    {t(`documents.status_${status.toLowerCase()}`)}
                  </Text>
                </View>
              )}
            </View>

            {status === 'REJECTED' && doc?.rejectReason ? (
              <Text style={styles.rejectReason}>{t('documents.rejectedReason', { reason: doc.rejectReason })}</Text>
            ) : null}

            {cap ? (
              <View>
                <Image source={{ uri: cap.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel={t(`documents.type_${field}`)} />
                <TouchableOpacity onPress={() => setCaptures((c) => { const n = { ...c }; delete n[field]; return n; })} accessibilityRole="button" accessibilityLabel={t('documents.removeCaptureA11y')}>
                  <Text style={styles.retake}>{t('documents.retake')}</Text>
                </TouchableOpacity>
              </View>
            ) : status === 'APPROVED' ? (
              <Text style={styles.approvedNote}>{t('documents.approvedNote')}</Text>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cameraBtn} onPress={() => capture(field, true)} accessibilityRole="button" accessibilityLabel={t('documents.cameraA11y', { doc: t(`documents.type_${field}`) })}>
                  <Text style={styles.cameraBtnText}>{t('documents.camera')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.galleryBtn} onPress={() => capture(field, false)} accessibilityRole="button" accessibilityLabel={t('documents.galleryA11y', { doc: t(`documents.type_${field}`) })}>
                  <Text style={styles.galleryBtnText}>{t('documents.gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {status === 'PENDING' && !cap ? <Text style={styles.pendingNote}>{t('documents.pendingNote')}</Text> : null}
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.btn, (!hasPendingCapture || submitting) && { opacity: 0.5 }]}
        onPress={submit}
        disabled={!hasPendingCapture || submitting}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{submitting ? t('documents.submitting') : t('common.submit')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md, alignItems: 'center' }} accessibilityRole="button">
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{t('common.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: fontSize.md, color: colors.muted, lineHeight: 22, marginTop: spacing.xs },
  tripCode: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.md },
  error: { color: colors.error, marginVertical: spacing.sm, textAlign: 'center' },
  approvedBanner: { padding: spacing.md, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', marginBottom: spacing.md },
  approvedText: { color: '#10b981', fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8 },
  statusText: { fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  rejectReason: { color: '#ef4444', fontSize: fontSize.sm, marginBottom: spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: 10 },
  retake: { color: colors.brand, fontWeight: '600', fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' },
  approvedNote: { color: colors.muted, fontSize: fontSize.sm },
  pendingNote: { color: colors.muted, fontSize: fontSize.xs, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cameraBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  cameraBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  galleryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  galleryBtnText: { color: colors.ink, fontWeight: '600', fontSize: fontSize.sm },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
