import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';
import { PAYMENT_ALLOWED_HOSTS, PAYMENT_SUCCESS_PATH, PAYMENT_CANCEL_PATH } from '../lib/config';
import { logWarn } from '../lib/logger';
import { validateCustomerInfo } from '../lib/validation';

// Fallbacks if /policies fetch fails — keep in sync with backend
// car-sharing-commission.js / car-sharing-policies.js.
const FALLBACK_TIERS = [
  { id: 'BASIC', label: 'Basic', price: 'Free', desc: 'No deductible reimbursement — you pay for all damages and file with host\'s insurer directly', deductible: 'N/A', limit: 'N/A' },
  { id: 'STANDARD', label: 'Standard', price: '$12/day', desc: 'Recommended — Ride reimburses the host\'s insurance deductible so you don\'t pay out of pocket', deductible: 'Up to $1,000', limit: 'Host deductible', recommended: true },
  { id: 'PREMIUM', label: 'Premium', price: '$22/day', desc: 'Ride reimburses host\'s insurance deductible + roadside assistance included', deductible: 'Up to $2,500', limit: 'Host deductible + roadside' },
];

const ADDON_EMOJI = { TIRE_PROTECTION: '🛞', GLASS_PROTECTION: '🪟', ROADSIDE_ASSISTANCE: '🚨', TOLL_PASS: '🛣' };

const FALLBACK_ADDONS = [
  { id: 'TIRE_PROTECTION', label: '🛞 Tire Protection', price: '$5/day', desc: 'Blowouts, flat tires, rim damage from road hazards' },
  { id: 'GLASS_PROTECTION', label: '🪟 Glass Protection', price: '$4/day', desc: 'Windshield chips/cracks, window and mirror glass' },
  { id: 'ROADSIDE_ASSISTANCE', label: '🚨 Roadside Assistance', price: '$6/day', desc: 'Towing, jump start, flat change, lockout, fuel delivery' },
  { id: 'TOLL_PASS', label: '🛣 Toll Pass', price: '$3.50/day', desc: 'Unlimited toll usage — AutoExpreso, SunPass, E-ZPass, TxTag' },
];

const FALLBACK_EXCLUSIONS = 'Tires, glass/windshield, wear and tear, mechanical breakdown, interior damage from normal use, personal property, liability to others, unauthorized drivers, off-road or illegal use.';

function fmtPerDay(pricePerDay) {
  const n = Number(pricePerDay || 0);
  if (n <= 0) return 'Free';
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}/day`;
}

function tiersFromApi(apiTiers) {
  if (!apiTiers || typeof apiTiers !== 'object') return null;
  const list = ['BASIC', 'STANDARD', 'PREMIUM']
    .map((id) => apiTiers[id])
    .filter(Boolean)
    .map((t) => ({
      id: t.id,
      label: t.label || t.id,
      price: fmtPerDay(t.pricePerDay),
      desc: t.description || '',
      deductible: Number(t.deductibleReimbursementMax) > 0 ? `Up to $${Number(t.deductibleReimbursementMax).toLocaleString()}` : 'N/A',
      limit: Number(t.deductibleReimbursementMax) > 0 ? `Host deductible${t.roadsideAssistance ? ' + roadside' : ''}` : 'N/A',
      recommended: t.id === 'STANDARD',
    }));
  return list.length >= 2 ? list : null;
}

function addonsFromApi(apiAddons) {
  if (!apiAddons || typeof apiAddons !== 'object') return null;
  const list = Object.values(apiAddons)
    .filter((a) => a && a.id && a.hostOffered !== false)
    .map((a) => ({
      id: a.id,
      label: `${ADDON_EMOJI[a.id] || '✚'} ${a.label || a.id}`,
      price: fmtPerDay(a.pricePerDay),
      desc: Array.isArray(a.covers) && a.covers.length ? a.covers.join(', ') : (a.description || ''),
    }));
  return list.length ? list : null;
}

function isAllowedPaymentUrl(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'about:') return false;
    return u.protocol === 'about:' || PAYMENT_ALLOWED_HOSTS.some(
      (host) => u.hostname === host || u.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export default function CheckoutScreen() {
  const { listingId, pickupAt, returnAt } = useLocalSearchParams();
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
  const [tiers, setTiers] = useState(FALLBACK_TIERS);
  const [addons, setAddons] = useState(FALLBACK_ADDONS);
  const [exclusionsText, setExclusionsText] = useState(FALLBACK_EXCLUSIONS);

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
    // Protection tiers / add-ons / exclusions come from the backend so
    // pricing changes don't require an app release. Fallbacks above.
    (async () => {
      try {
        const data = await api('/api/public/booking/policies');
        const apiTiers = tiersFromApi(data?.protectionTiers);
        if (apiTiers) setTiers(apiTiers);
        const apiAddons = addonsFromApi(data?.policies?.addons);
        if (apiAddons) setAddons(apiAddons);
        if (Array.isArray(data?.protectionExclusions) && data.protectionExclusions.length) {
          setExclusionsText(data.protectionExclusions.join(' · '));
        }
      } catch (err) {
        logWarn('Failed to load policies, using fallback copy: ' + (err?.message || err));
      }
    })();
  }, [listingId]);

  const isInfoComplete = customer.firstName.trim() && customer.lastName.trim() && customer.email.trim() && customer.phone.trim();

  function validateInfo() {
    return validateCustomerInfo(customer);
  }

  function handleContinue() {
    const msg = validateInfo();
    if (msg) { setError(msg); return; }
    setError('');
    setStep(2);
  }
  const isProtectionSelected = protectionTier !== 'BASIC' || (declinedProtection && ownInsuranceConfirmed);

  async function handleSubmit() {
    if (!isProtectionSelected) {
      setError('Please select a Trip Protection tier or confirm you have your own insurance.');
      return;
    }
    const infoError = validateInfo();
    if (infoError) { setError(infoError); return; }
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
          pickupAt: pickupAt || new Date(Date.now() + 86400000).toISOString(),
          returnAt: returnAt || new Date(Date.now() + 86400000 * 4).toISOString(),
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
          <TouchableOpacity onPress={() => setStep(3)} accessibilityRole="button" accessibilityLabel="Done with payment">
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
          onShouldStartLoadWithRequest={(request) => {
            // Only allow navigation to our API host and known payment gateways.
            if (isAllowedPaymentUrl(request.url)) return true;
            console.warn('Blocked payment WebView navigation to:', request.url);
            return false;
          }}
          onNavigationStateChange={(navState) => {
            // Backend redirects to its own return pages after payment:
            // /api/public/booking/trips/:tripCode/payment-return | payment-cancel
            try {
              const path = new URL(String(navState.url || '')).pathname;
              if (path.endsWith(PAYMENT_SUCCESS_PATH)) {
                setStep(3);
              } else if (path.endsWith(PAYMENT_CANCEL_PATH)) {
                setError('Payment was cancelled. You can try again.');
                setStep(2);
              }
            } catch {}
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
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/trips')} accessibilityRole="button">
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
            <TextInput style={styles.input} placeholder="First name" placeholderTextColor={colors.muted} value={customer.firstName} onChangeText={(v) => setCustomer((c) => ({ ...c, firstName: v }))} accessibilityLabel="First name" />
            <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={colors.muted} value={customer.lastName} onChangeText={(v) => setCustomer((c) => ({ ...c, lastName: v }))} accessibilityLabel="Last name" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} value={customer.email} onChangeText={(v) => setCustomer((c) => ({ ...c, email: v }))} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email" />
            <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={colors.muted} value={customer.phone} onChangeText={(v) => setCustomer((c) => ({ ...c, phone: v }))} keyboardType="phone-pad" accessibilityLabel="Phone" />

            <TouchableOpacity style={[styles.btn, !isInfoComplete && styles.btnDisabled]} onPress={handleContinue} disabled={!isInfoComplete} accessibilityRole="button">
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

            {tiers.map((tier) => (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierCard, protectionTier === tier.id && styles.tierCardActive]}
                onPress={() => setProtectionTier(tier.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tier.label} protection tier, ${tier.price}`}
                accessibilityState={{ selected: protectionTier === tier.id }}
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
              accessibilityRole="button"
              accessibilityLabel="I have my own insurance"
              accessibilityState={{ selected: declinedProtection }}
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
                  accessibilityRole="checkbox"
                  accessibilityLabel="I confirm I carry valid auto insurance and accept full financial responsibility"
                  accessibilityState={{ checked: ownInsuranceConfirmed }}
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
              <Text style={{ fontWeight: '700', color: colors.warning, fontSize: fontSize.sm, marginBottom: spacing.xs }}>⚠️ NOT covered by any protection tier:</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.muted, lineHeight: 18 }}>{exclusionsText}</Text>
            </View>

            {/* Optional Add-ons */}
            <Text style={styles.sectionTitle}>Optional Add-ons</Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginBottom: spacing.sm }}>Available add-ons depend on what the host offers for this vehicle.</Text>

            {addons.map((addon) => (
              <View key={addon.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.ink, fontSize: fontSize.sm }}>{addon.label}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{addon.desc}</Text>
                </View>
                <Text style={{ fontWeight: '700', color: colors.brand, fontSize: fontSize.sm }}>{addon.price}</Text>
              </View>
            ))}

            {/* Key Policies */}
            <Text style={styles.sectionTitle}>Trip Policies</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Cancellation</Text>
              <Text style={styles.reviewValue}>Free cancellation up to 48 hours before pickup. 24-48hr: 50% of first day. Under 24hr: 100% of first day. No-show: full trip charged.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Mileage</Text>
              <Text style={styles.reviewValue}>200 miles/day included (host may set different limit). Excess: $0.35/mile.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Fuel</Text>
              <Text style={styles.reviewValue}>Return at same fuel level. Shortage: $5/gal + $25 refueling fee. EV: $0.30/kWh + $15 fee.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Late Return</Text>
              <Text style={styles.reviewValue}>30-min grace period. After: $25/hr. 2+ hours: full extra day. 6+ hours no contact: deposit forfeited.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Security Deposit</Text>
              <Text style={styles.reviewValue}>$250 hold at booking (up to $500 for select vehicles). Released within 48 hours of clean return.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Tolls</Text>
              <Text style={styles.reviewValue}>If vehicle has a toll pass and you add Toll Pass ($3.50/day): unlimited tolls. Without: tolls charged by plate + $5 admin fee per toll.</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Cleaning</Text>
              <Text style={styles.reviewValue}>Return vehicle clean. Fees: $30 (light) to $250 (severe). Smoking: $250. Unauthorized pets: $150.</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep(1)} accessibilityRole="button" accessibilityLabel="Back to your information">
                <Text style={styles.ghostBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
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
