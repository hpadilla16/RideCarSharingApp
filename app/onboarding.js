import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize } from '../lib/theme';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'ride_onboarding_done';

const slides = [
  {
    emoji: '🚗',
    title: 'Welcome to Ride Car Sharing',
    body: 'Browse locally hosted vehicles, book instantly, and enjoy trip protection on every booking.',
    accent: colors.brand,
  },
  {
    emoji: '🛡',
    title: 'Trip Protection',
    body: 'Our Trip Protection Program helps coordinate damage resolution between guests and hosts. IT IS NOT INSURANCE AND DOES NOT REPLACE YOUR AUTO INSURANCE.\n\nWhat happens if damage occurs during a trip:\n\n• Basic (Free) — Guest is responsible for all costs. Host files with their own insurance.\n• Standard ($12/day) — Ride pays the host\'s insurance deductible (up to $1,000) so the host\'s insurer covers the repair.\n• Premium ($22/day) — Ride pays the host\'s insurance deductible (up to $2,500) + provides roadside assistance.\n\n🛡 FOR HOSTS — What this means for you:\n• When a guest selects Standard or Premium, we reimburse YOUR insurance deductible only\n• Your insurance company handles the actual repair claim\n• You MUST carry auto insurance that meets your state minimum requirements\n• You MUST notify your insurer that you share your vehicle peer-to-peer\n\n⚠️ IF YOU DO NOT HAVE VALID INSURANCE:\n• Ride is NOT responsible for any vehicle damage\n• You will not receive any deductible reimbursement\n• You accept full financial responsibility for your vehicle\n\nThis is a limited reimbursement program, not insurance coverage.',
    accent: '#047857',
  },
  {
    emoji: '📋',
    title: 'How It Works',
    body: '1. Browse and book a car\n2. Coordinate pickup with your host via Trip Chat\n3. Take inspection photos before your trip\n4. Drive safe and enjoy!\n5. Return the vehicle and complete your review\n\nYour host sets the rules — check the listing for details on mileage, fuel, and pickup instructions.',
    accent: '#0fb0d8',
  },
  {
    emoji: '⚖️',
    title: 'Important Legal Notice',
    body: 'By using Ride Car Sharing, you agree to our Terms of Service:\n\n• Ride is a peer-to-peer marketplace, NOT a rental company\n• We do not own, insure, or inspect the vehicles\n• Hosts are independent vehicle owners\n• Trip Protection is NOT insurance\n• You must be 21+ with a valid driver\'s license\n• You are responsible for damages beyond your selected protection tier\n\nFull terms available at ride-carsharing.com/terms',
    accent: '#b45309',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);

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
          <TouchableOpacity style={styles.backBtn} onPress={() => setPage(page - 1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {isLast ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={complete}>
            <Text style={styles.primaryText}>I Agree & Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setPage(page + 1)}>
            <Text style={styles.primaryText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={complete}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Terms link on legal page */}
      {page === 3 && (
        <TouchableOpacity onPress={() => Linking.openURL('https://ride-carsharing.com/terms')}>
          <Text style={styles.termsLink}>Read Full Terms of Service →</Text>
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
