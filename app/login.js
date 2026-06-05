import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api, storeGuestSession } from '../lib/api';
import { colors, spacing, fontSize } from '../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function requestLink() {
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    try {
      await api('/api/public/booking/guest-signin/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Unable to send sign-in link');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📧</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a sign-in link to {email}. Click the link to access your trips. It expires in 15 minutes.
        </Text>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => { setSent(false); setEmail(''); }} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.center}>
        <Text style={styles.title}>Guest Sign In</Text>
        <Text style={styles.subtitle}>Enter your email to receive a secure sign-in link. No password needed.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Email address"
        />

        <TouchableOpacity style={styles.btn} onPress={requestLink} disabled={loading} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send Sign-in Link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Back to Explore</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg, maxWidth: 300 },
  error: { color: colors.error, marginBottom: spacing.md, fontSize: fontSize.sm, textAlign: 'center' },
  input: { width: '100%', maxWidth: 320, height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, fontSize: fontSize.md, backgroundColor: colors.card, color: colors.ink, marginBottom: spacing.md },
  btn: { width: '100%', maxWidth: 320, height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  ghostBtn: { paddingVertical: spacing.sm },
  ghostBtnText: { color: colors.brand, fontWeight: '600', fontSize: fontSize.sm },
});
