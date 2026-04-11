import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { colors, spacing, fontSize } from '../lib/theme';

const ISSUE_TYPES = [
  { id: 'VEHICLE_DAMAGE', label: 'Vehicle Damage' },
  { id: 'BILLING', label: 'Billing Issue' },
  { id: 'SERVICE', label: 'Service Issue' },
  { id: 'SAFETY', label: 'Safety Concern' },
  { id: 'OTHER', label: 'Other' },
];

export default function IssueScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ reference: '', email: '', type: 'SERVICE', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!form.reference.trim() || !form.email.trim() || !form.description.trim()) {
      setError('Please fill all required fields');
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
      setError(err?.message || 'Unable to submit issue');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🎫</Text>
        <Text style={styles.title}>Issue Reported</Text>
        <Text style={styles.subtitle}>Our support team will review your report and follow up via email.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={styles.title}>Report an Issue</Text>
        <Text style={styles.subtitle}>Let us know about a problem with your trip.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Booking reference</Text>
        <TextInput style={styles.input} placeholder="Trip code or reservation number" placeholderTextColor={colors.muted} value={form.reference} onChangeText={(v) => setForm((f) => ({ ...f, reference: v }))} />

        <Text style={styles.label}>Your email</Text>
        <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.muted} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Issue type</Text>
        <View style={styles.typeRow}>
          {ISSUE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setForm((f) => ({ ...f, type: t.id }))}
              style={[styles.typeBtn, form.type === t.id && styles.typeBtnActive]}
            >
              <Text style={[styles.typeText, form.type === t.id && styles.typeTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="Describe what happened..."
          placeholderTextColor={colors.muted}
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Submitting...' : 'Submit Report'}</Text>
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
