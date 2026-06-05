import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { hostLogin } from '../../lib/hostApi';
import { colors, spacing, fontSize } from '../../lib/theme';

export default function HostLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    try {
      await hostLogin(email.trim(), password);
      router.replace('/host');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.center}>
        <Text style={styles.title}>Host Sign In</Text>
        <Text style={styles.subtitle}>Manage your listings, trips, and earnings.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel="Password" />
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} accessibilityRole="button">
          <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }} accessibilityRole="button">
          <Text style={{ color: colors.brand, fontWeight: '600' }}>← Back to Guest</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', marginBottom: spacing.xl },
  error: { color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  input: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, fontSize: fontSize.md, backgroundColor: colors.card, marginBottom: spacing.md },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
