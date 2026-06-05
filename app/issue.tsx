import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

const ISSUE_TYPE_IDS = ['VEHICLE_DAMAGE', 'BILLING', 'SERVICE', 'SAFETY', 'OTHER'];

interface IssueForm {
  reference: string;
  email: string;
  type: string;
  description: string;
}

interface IssueResult {
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function IssueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const ISSUE_TYPES = ISSUE_TYPE_IDS.map((id) => ({ id, label: t(`issue.type_${id}`) }));
  const [form, setForm] = useState<IssueForm>({ reference: '', email: '', type: 'SERVICE', description: '' });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState<string>('');

  async function handleSubmit() {
    if (!form.reference.trim() || !form.email.trim() || !form.description.trim()) {
      setError(t('issue.fillRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await api('/api/public/booking/issues', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setResult(data);
    } catch (err) {
      setError(errMsg(err) || t('issue.unableToSubmit'));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🎫</Text>
        <Text style={styles.title}>{t('issue.reportedTitle')}</Text>
        <Text style={styles.subtitle}>{t('issue.reportedBody')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={styles.title}>{t('issue.title')}</Text>
        <Text style={styles.subtitle}>{t('issue.subtitle')}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>{t('issue.bookingReference')}</Text>
        <TextInput style={styles.input} placeholder={t('issue.referencePlaceholder')} placeholderTextColor={colors.muted} value={form.reference} onChangeText={(v) => setForm((f) => ({ ...f, reference: v }))} accessibilityLabel={t('issue.referencePlaceholder')} />

        <Text style={styles.label}>{t('issue.yourEmail')}</Text>
        <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.muted} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={t('issue.yourEmail')} />

        <Text style={styles.label}>{t('issue.issueType')}</Text>
        <View style={styles.typeRow}>
          {ISSUE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setForm((f) => ({ ...f, type: t.id }))}
              style={[styles.typeBtn, form.type === t.id && styles.typeBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: form.type === t.id }}
            >
              <Text style={[styles.typeText, form.type === t.id && styles.typeTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('issue.description')}</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder={t('issue.descriptionPlaceholder')}
          placeholderTextColor={colors.muted}
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          multiline
          numberOfLines={4}
          accessibilityLabel={t('issue.descriptionA11y')}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
          <Text style={styles.btnText}>{submitting ? t('issue.submitting') : t('issue.submitReport')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.muted, marginBottom: spacing.lg, lineHeight: 22 },
  error: { color: colors.error, marginBottom: spacing.md, fontSize: fontSize.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted, marginBottom: spacing.xs, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, backgroundColor: colors.card, color: colors.ink, marginBottom: spacing.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  typeBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  typeBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted },
  typeTextActive: { color: colors.white },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
