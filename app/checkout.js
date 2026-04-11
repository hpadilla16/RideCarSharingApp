import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://ridefleetmanager.com';

export default function CheckoutScreen() {
  const { listingId } = useLocalSearchParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [protectionTier, setProtectionTier] = useState('STANDARD');
  const [declinedProtection, setDeclinedProtection] = useState(false);
  const [ownInsuranceConfirmed, setOwnInsuranceConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const boot = await api('/api/public/booking/bootstrap');
        const match = (boot?.featuredCarSharingListings || []).find((l) => l.id === listingId);
        setListing(match || null);
      } catch (err) {
        setError(err?.message || 'Unable to load listing');
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  const isInfoComplete = customer.firstName.trim() && customer.lastName.trim() && customer.email.trim() && customer.phone.trim();
  const isProtectionSelected = protectionTier !== 'BASIC' || (declinedProtection && ownInsuranceConfirmed);

  async function handleSubmit() {
    if (!isProtectionSelected) {
      setError('Please select a Trip Protection tier or confirm you have your own insurance.');
      return;
    }
    if (!isInfoComplete) { setError('Please fill all fields'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await api('/api/public/booking/checkout', {
        method: 'POST',
        body: JSON.stringify({
          searchType: 'CAR_SHARING',
          listingId,
          pickupLocationId: listing?.location?.id || '',
          returnLocationId: listing?.location?.id || '',
          pickupAt: new Date(Date.now() + 86400000).toISOString(),
          returnAt: new Date(Date.now() + 86400000 * 4).toISOString(),
          customer,
        }),
      });
      // Check if backend returned a payment portal link
      const portalLink = result?.nextActions?.find((a) => a?.link)?.link
        || result?.paymentLink
        || result?.portalLink
        || null;
      if (portalLink) {
        setPaymentUrl(portalLink);
        setStep('payment');
      } else {
        setStep(3);
      }
    } catch (err) {
      setError(err?.message || 'Unable to complete booking');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><Text style={styles.muted}>Loading...</Text></View>;

  // Payment WebView
  if (step === 'payment' && paymentUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentHeaderTitle}>Complete Payment</Text>
          <TouchableOpacity onPress={() => setStep(3)}>
            <Text style={{ color: colors.brand, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={{ color: colors.muted, marginTop: spacing.md }}>Loading payment portal...</Text>
            </View>
          )}
          onNavigationStateChange={(navState) => {
            // Detect when payment completes (URL contains success/confirmed/complete)
            const url = String(navState.url || '').toLowerCase();
            if (url.includes('success') || url.includes('confirmed') || url.includes('complete') || url.includes('thank')) {
              setStep(3);
            }
          }}
          onError={() => {
            setError('Payment page failed to load. Please try again.');
            setStep(2);
          }}
        />
      </View>
    );
  }

  if (step === 3) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🎉</Text>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Check your email for trip details and next steps.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/trips')}>
          <Text style={styles.btnText}>View My Trips</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        </View>
        <Text style={styles.stepLabel}>Step {step} of 2</Text>

        {/* Vehicle summary */}
        {listing && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{listing.title || vehicleLabel(listing)}</Text>
            <Text style={styles.summaryPrice}>{fmtMoney(listing.baseDailyRate)}/day</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>Your Information</Text>
            <TextInput style={styles.input} placeholder="First name" placeholderTextColor={colors.muted} value={customer.firstName} onChangeText={(v) => setCustomer((c) => ({ ...c, firstName: v }))} />
            <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={colors.muted} value={customer.lastName} onChangeText={(v) => setCustomer((c) => ({ ...c, lastName: v }))} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} value={customer.email} onChangeText={(v) => setCustomer((c) => ({ ...c, email: v }))} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={colors.muted} value={customer.phone} onChangeText={(v) => setCustomer((c) => ({ ...c, phone: v }))} keyboardType="phone-pad" />

            <TouchableOpacity style={[styles.btn, !isInfoComplete && styles.btnDisabled]} onPress={() => isInfoComplete && setStep(2)} disabled={!isInfoComplete}>
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>Review & Confirm</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Guest</Text>
              <Text style={styles.reviewValue}>{customer.firstName} {customer.lastName}</Text>
              <Text style={styles.reviewValue}>{customer.email}</Text>
            </View>

            {/* Trip Protection Tier Selection */}
            <Text style={styles.sectionTitle}>Trip Protection</Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginBottom: spacing.sm }}>Trip Protection is NOT insurance. It is a limited program where Ride reimburses the host's insurance deductible only. Your own auto insurance and the host's auto insurance are the primary coverage. Ride does not cover repair costs, liability claims, or property damage directly.</Text>

            {[
              { id: 'BASIC', label: 'Basic', price: 'Free', desc: 'No deductible reimbursement — you pay for all damages and file with host\'s insurer directly', deductible: 'N/A', limit: 'N/A' },
              { id: 'STANDARD', label: 'Standard', price: '$12/day', desc: 'Recommended — Ride reimburses the host\'s insurance deductible so you don\'t pay out of pocket', deductible: 'Up to $1,000', limit: 'Host deductible', recommended: true },
              { id: 'PREMIUM', label: 'Premium', price: '$22/day', desc: 'Ride reimburses host\'s insurance deductible + roadside assistance included', deductible: 'Up to $2,500', limit: 'Host deductible + roadside' },
            ].map((tier) => (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierCard, protectionTier === tier.id && styles.tierCardActive]}
                onPress={() => setProtectionTier(tier.id)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={[styles.tierRadio, protectionTier === tier.id && styles.tierRadioActive]} />
                    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: fontSize.md }}>{tier.label}</Text>
                    {tier.recommended && <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '700' }}>Recommended</Text>}
                  </View>
                  <Text style={{ fontWeight: '800', color: colors.brand, fontSize: fontSize.md }}>{tier.price}</Text>
                </View>
                <Text style={{ fontSize: fontSize.sm, color: colors.muted, marginTop: 4 }}>{tier.desc}</Text>
                {tier.id !== 'BASIC' && (
                  <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>Deductible: {tier.deductible}</Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>Up to: {tier.limit}</Text>
                  </View>
                )}
                {tier.id !== 'BASIC' && (
                  <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '600', marginTop: 4 }}>🛡 Ride reimburses the host's insurance deductible — host must carry valid auto insurance with state minimums</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Decline with own insurance option */}
            <TouchableOpacity
              style={[styles.tierCard, declinedProtection && styles.tierCardActive, { borderColor: declinedProtection ? colors.warning : colors.border }]}
              onPress={() => { setDeclinedProtection(!declinedProtection); if (!declinedProtection) setProtectionTier('BASIC'); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.tierRadio, declinedProtection && { borderColor: colors.warning, backgroundColor: colors.warning }]} />
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: fontSize.md }}>I have my own insurance</Text>
              </View>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted, marginTop: 4 }}>I decline Trip Protection and confirm I carry personal auto insurance that covers peer-to-peer rentals.</Text>
              {declinedProtection && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}
                  onPress={() => setOwnInsuranceConfirmed(!ownInsuranceConfirmed)}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: ownInsuranceConfirmed ? colors.brand : colors.border, backgroundColor: ownInsuranceConfirmed ? colors.brand : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                    {ownInsuranceConfirmed && <Text style={{ color: colors.white, fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.ink }}>I confirm I carry valid auto insurance and accept full financial responsibility for any damages not covered by my policy.</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Exclusions */}
            <View style={{ padding: spacing.md, backgroundColor: 'rgba(255,194,88,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,194,88,0.15)' }}>
              <Text style={{ fontWeight: '700', color: colors.warning, fontSize: fontSize.sm, marginBottom: spacing.xs }}>⚠️ NOT covered by any tier:</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.muted, lineHeight: 18 }}>Tires, glass/windshield, wear and tear, mechanical breakdown, interior damage from normal use, personal property, liability to others, unauthorized drivers, off-road or illegal use.</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.brand, fontWeight: '600', marginTop: spacing.xs }}>Tire Protection ($5/day), Glass Protection ($4/day), and Roadside Assistance ($6/day) may be available as add-ons depending on the host.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Cancellation</Text>
              <Text style={styles.reviewValue}>Free cancellation up to 24h before pickup</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep(1)}>
                <Text style={styles.ghostBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.btnText}>{submitting ? 'Confirming...' : 'Confirm Booking'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: spacing.xl, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  paymentHeaderTitle: { fontWeight: '800', color: colors.ink, fontSize: fontSize.lg },
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.muted, textAlign: 'center', marginBottom: spacing.lg },
  muted: { color: colors.muted },
  error: { color: colors.error, marginBottom: spacing.md, fontSize: fontSize.sm },
  tierCard: { padding: spacing.md, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, marginBottom: spacing.sm },
  tierCardActive: { borderColor: colors.brand, backgroundColor: 'rgba(135,82,254,0.04)' },
  tierRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  tierRadioActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.brand },
  progressLine: { width: 60, height: 2, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  progressLineActive: { backgroundColor: colors.brand },
  stepLabel: { textAlign: 'center', fontSize: fontSize.sm, color: colors.muted, marginBottom: spacing.lg },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, marginBottom: spacing.lg },
  summaryTitle: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md, flex: 1 },
  summaryPrice: { fontWeight: '800', color: colors.brand, fontSize: fontSize.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.ink, marginBottom: spacing.md },
  input: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, fontSize: fontSize.md, backgroundColor: colors.card, color: colors.ink, marginBottom: spacing.md },
  btn: { height: 52, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  ghostBtn: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  ghostBtnText: { color: colors.brand, fontWeight: '700', fontSize: fontSize.md },
  reviewCard: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm },
  reviewLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: 4 },
  reviewValue: { fontSize: fontSize.sm, color: colors.ink },
});
