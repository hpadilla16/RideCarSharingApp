import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'ride_onboarding_done';

const SLIDE_META = [
  { key: 'welcome', emoji: '🚗', accent: colors.brand },
  { key: 'protection', emoji: '🛡', accent: '#047857' },
  { key: 'howItWorks', emoji: '📋', accent: '#0fb0d8' },
  { key: 'legal', emoji: '⚖️', accent: '#b45309' },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const slides = SLIDE_META.map((s) => ({
    emoji: s.emoji,
    accent: s.accent,
    title: t(`onboarding.${s.key}Title`),
    body: t(`onboarding.${s.key}Body`),
  }));

  async function complete() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  }

  const slide = slides[page];
  const isLast = page === slides.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.slideContainer}>
        <Text style={[styles.emoji, { color: slide.accent }]}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{slide.body}</Text>
        </ScrollView>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, idx) => (
          <View key={idx} style={[styles.dot, page === idx && styles.dotActive]} />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        {page > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setPage(page - 1)} accessibilityRole="button" accessibilityLabel={t('onboarding.backA11y')}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {isLast ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={complete} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('onboarding.agreeContinue')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setPage(page + 1)} accessibilityRole="button" accessibilityLabel={t('onboarding.nextA11y')}>
            <Text style={styles.primaryText}>{t('onboarding.next')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={complete} accessibilityRole="button" accessibilityLabel={t('onboarding.skipA11y')}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      )}

      {/* Terms link on legal page */}
      {page === 3 && (
        <TouchableOpacity onPress={() => Linking.openURL('https://ride-carsharing.com/terms')} accessibilityRole="button" accessibilityLabel={t('onboarding.readTermsA11y')}>
          <Text style={styles.termsLink}>{t('onboarding.readTerms')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export async function shouldShowOnboarding() {
  try {
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    return done !== 'true';
  } catch { return true; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'center' },
  slideContainer: { alignItems: 'center', marginBottom: spacing.xl },
  emoji: { fontSize: 64, marginBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.md },
  body: { fontSize: fontSize.md, color: colors.muted, lineHeight: 24, textAlign: 'center', paddingHorizontal: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.brand },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  backText: { color: colors.muted, fontWeight: '700', fontSize: fontSize.md },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: colors.brand },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  skip: { alignItems: 'center', marginTop: spacing.lg },
  skipText: { color: colors.muted, fontSize: fontSize.sm },
  termsLink: { color: colors.brand, fontWeight: '700', fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.md },
});
