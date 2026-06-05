import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { hostApi, readHostSession } from '../../lib/hostApi';
import { fmtDate } from '../../lib/format';
import { colors, spacing, fontSize } from '../../lib/theme';
import { logError } from '../../lib/logger';
import { useTranslation } from 'react-i18next';

interface AvailabilityWindow {
  id: string;
  startAt?: string;
  endAt?: string;
  isBlocked?: boolean;
  note?: string | null;
  priceOverride?: number | string | null;
  minTripDaysOverride?: number | null;
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function HostAvailabilityScreen() {
  const { t } = useTranslation();
  const { listingId, title } = useLocalSearchParams<{ listingId?: string; title?: string }>();
  const router = useRouter();
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(23, 59, 0, 0); return d;
  });
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false);

  async function load() {
    if (!listingId) {
      setError(t('hostAvailability.missingListing'));
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await hostApi<AvailabilityWindow[]>(`/listings/${encodeURIComponent(listingId)}/availability`);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(a.startAt || 0).getTime() - new Date(b.startAt || 0).getTime());
      setWindows(list);
    } catch (err) {
      logError(err, { screen: 'host/availability', listingId });
      setError(errMsg(err) || t('hostAvailability.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { token } = await readHostSession();
      if (!token) { router.replace('/host/login'); return; }
      load();
    })();
  }, [listingId]);

  async function saveBlock() {
    setSaving(true);
    setError('');
    try {
      await hostApi(`/listings/${encodeURIComponent(listingId || '')}/availability`, {
        method: 'POST',
        body: JSON.stringify({
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          isBlocked: true,
          note: note.trim() || undefined,
        }),
      });
      setNote('');
      await load();
    } catch (err) {
      logError(err, { screen: 'host/availability', listingId, action: 'block' });
      setError(errMsg(err) || t('hostAvailability.unableToSave'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(w: AvailabilityWindow) {
    Alert.alert(t('hostAvailability.deleteConfirmTitle'), t('hostAvailability.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('hostAvailability.delete'),
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await hostApi(`/availability/${encodeURIComponent(w.id)}`, { method: 'DELETE' });
            await load();
          } catch (err) {
            logError(err, { screen: 'host/availability', listingId, action: 'delete' });
            setError(errMsg(err) || t('hostAvailability.unableToDelete'));
          }
        },
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('hostAvailability.backA11y')}>
        <Text style={{ color: colors.brand, fontWeight: '600', marginBottom: spacing.md }}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('hostAvailability.title')}</Text>
      {title ? <Text style={styles.subtitle}>{title}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Block dates form */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{t('hostAvailability.blockDates')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)} accessibilityRole="button" accessibilityLabel={t('hostAvailability.startDateA11y', { date: fmtDate(startDate) })}>
            <Text style={styles.dateLabel}>{t('hostAvailability.from')}</Text>
            <Text style={styles.dateValue}>{fmtDate(startDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)} accessibilityRole="button" accessibilityLabel={t('hostAvailability.endDateA11y', { date: fmtDate(endDate) })}>
            <Text style={styles.dateLabel}>{t('hostAvailability.until')}</Text>
            <Text style={styles.dateValue}>{fmtDate(endDate)}</Text>
          </TouchableOpacity>
        </View>
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(e, date) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (date) {
                date.setHours(0, 0, 0, 0);
                setStartDate(date);
                if (date >= endDate) {
                  const r = new Date(date); r.setDate(r.getDate() + 1); r.setHours(23, 59, 0, 0);
                  setEndDate(r);
                }
              }
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            minimumDate={new Date(startDate.getTime() + 86400000)}
            onChange={(e, date) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (date) { date.setHours(23, 59, 0, 0); setEndDate(date); }
            }}
          />
        )}
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('hostAvailability.notePlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('hostAvailability.noteA11y')}
        />
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveBlock}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('hostAvailability.saveBlockA11y')}
        >
          <Text style={styles.saveBtnText}>{saving ? t('hostAvailability.saving') : t('hostAvailability.blockDates')}</Text>
        </TouchableOpacity>
      </View>

      {/* Windows list */}
      <Text style={styles.sectionTitle}>{t('hostAvailability.windows')}</Text>
      {!windows.length && <Text style={{ color: colors.muted }}>{t('hostAvailability.noWindows')}</Text>}
      {windows.map((w) => (
        <View key={w.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDates}>{fmtDate(w.startAt)} — {fmtDate(w.endAt)}</Text>
            {w.isBlocked ? (
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedText}>{t('hostAvailability.blocked')}</Text>
              </View>
            ) : null}
            {w.note ? <Text style={styles.cardNote}>{w.note}</Text> : null}
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(w)} accessibilityRole="button" accessibilityLabel={t('hostAvailability.deleteA11y', { start: fmtDate(w.startAt), end: fmtDate(w.endAt) })}>
            <Text style={styles.deleteText}>{t('hostAvailability.delete')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: fontSize.md, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.error, marginVertical: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm, marginTop: spacing.md },
  formCard: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  dateField: { flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.bg },
  dateLabel: { fontSize: fontSize.xs, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' },
  dateValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.ink, marginTop: 2 },
  input: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.sm, backgroundColor: colors.bg, color: colors.ink, marginTop: spacing.sm },
  saveBtn: { height: 48, borderRadius: 12, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardDates: { fontWeight: '700', color: colors.ink, fontSize: fontSize.sm },
  cardNote: { fontSize: fontSize.xs, color: colors.muted, marginTop: 4 },
  blockedBadge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)', marginTop: 4 },
  blockedText: { fontSize: fontSize.xs, fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  deleteText: { color: '#ef4444', fontWeight: '600', fontSize: fontSize.sm },
});
