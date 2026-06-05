import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { hostLogin } from '../../lib/hostApi';
import { colors, spacing, fontSize } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function HostLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function handleLogin() {
    if (!email.trim() || !password) { setError(t('hostLogin.emailPasswordRequired')); return; }
    setLoading(true); setError('');
    try {
      await hostLogin(email.trim(), password);
      router.replace('/host');
    } catch (err) { setError(errMsg(err)); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.center}>
        <Text style={styles.title}>{t('hostLogin.title')}</Text>
        <Text style={styles.subtitle}>{t('hostLogin.subtitle')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput style={styles.input} placeholder={t('hostLogin.email')} placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={t('hostLogin.email')} />
        <TextInput style={styles.input} placeholder={t('hostLogin.password')} placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel={t('hostLogin.password')} />
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} accessibilityRole="button">
          <Text style={styles.btnText}>{loading ? t('hostLogin.signingIn') : t('common.signIn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }} accessibilityRole="button">
          <Text style={{ color: colors.brand, fontWeight: '600' }}>{t('hostLogin.backToGuest')}</Text>
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
