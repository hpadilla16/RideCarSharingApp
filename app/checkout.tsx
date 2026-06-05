import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';
import { PAYMENT_SUCCESS_PATH, PAYMENT_CANCEL_PATH } from '../lib/config';
import { logWarn } from '../lib/logger';
import { validateCustomerInfo } from '../lib/validation';
import { tiersFromApi, addonsFromApi, isAllowedPaymentUrl } from '../lib/checkoutPolicies';
import type { Tier, Addon, ApiTier, ApiAddon } from '../lib/checkoutPolicies';
import { useTranslation } from 'react-i18next';

interface CheckoutListing {
  id: string;
  title?: string;
  baseDailyRate?: number | string | null;
  location?: { id?: string } | null;
  vehicle?: { year?: number | string; make?: string; model?: string } | null;
  [key: string]: unknown;
}

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Fallbacks if /policies fetch fails — keep in sync with backend
// car-sharing-commission.js / car-sharing-policies.js.
const FALLBACK_TIERS: Tier[] = [
  { id: 'BASIC', label: 'Basic', price: 'Free', desc: 'No deductible reimbursement — you pay for all damages and file with host\'s insurer directly', deductible: 'N/A', limit: 'N/A' },
  { id: 'STANDARD', label: 'Standard', price: '$12/day', desc: 'Recommended — Ride reimburses the host\'s insurance deductible so you don\'t pay out of pocket', deductible: 'Up to $1,000', limit: 'Host deductible', recommended: true },
  { id: 'PREMIUM', label: 'Premium', price: '$22/day', desc: 'Ride reimburses host\'s insurance deductible + roadside assistance included', deductible: 'Up to $2,500', limit: 'Host deductible + roadside' },
];

const FALLBACK_ADDONS: Addon[] = [
  { id: 'TIRE_PROTECTION', label: '🛞 Tire Protection', price: '$5/day', desc: 'Blowouts, flat tires, rim damage from road hazards' },
  { id: 'GLASS_PROTECTION', label: '🪟 Glass Protection', price: '$4/day', desc: 'Windshield chips/cracks, window and mirror glass' },
  { id: 'ROADSIDE_ASSISTANCE', label: '🚨 Roadside Assistance', price: '$6/day', desc: 'Towing, jump start, flat change, lockout, fuel delivery' },
  { id: 'TOLL_PASS', label: '🛣 Toll Pass', price: '$3.50/day', desc: 'Unlimited toll usage — AutoExpreso, SunPass, E-ZPass, TxTag' },
];

const FALLBACK_EXCLUSIONS = 'Tires, glass/windshield, wear and tear, mechanical breakdown, interior damage from normal use, personal property, liability to others, unauthorized drivers, off-road or illegal use.';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { listingId, pickupAt, returnAt } = useLocalSearchParams<{ listingId?: string; pickupAt?: string; returnAt?: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<CheckoutListing | null>(null);
  const [step, setStep] = useState<number | 'payment'>(1);
  const [customer, setCustomer] = useState<CustomerForm>({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [protectionTier, setProtectionTier] = useState<string>('STANDARD');
  const [declinedProtection, setDeclinedProtection] = useState<boolean>(false);
  const [ownInsuranceConfirmed, setOwnInsuranceConfirmed] = useState<boolean>(false);
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  const [addons, setAddons] = useState<Addon[]>(FALLBACK_ADDONS);
  const [exclusionsText, setExclusionsText] = useState<string>(FALLBACK_EXCLUSIONS);

  useEffect(() => {
    (async () => {
      try {
        const boot = await api<{ featuredCarSharingListings?: CheckoutListing[] }>('/api/public/booking/bootstrap');
        const match = (boot?.featuredCarSharingListings || []).find((l) => l.id === listingId);
        setListing(match || null);
      } catch (err) {
        setError(errMsg(err) || t('checkout.unableToLoadListing'));
      } finally {
        setLoading(false);
      }
    })();
    // Protection tiers / add-ons / exclusions come from the backend so
    // pricing changes don't require an app release. Fallbacks above.
    (async () => {
      try {
        const data = await api<{
          protectionTiers?: Record<string, ApiTier>;
          protectionExclusions?: string[];
          policies?: { addons?: Record<string, ApiAddon> };
        }>('/api/public/booking/policies');
        const apiTiers = tiersFromApi(data?.protectionTiers);
        if (apiTiers) setTiers(apiTiers);
        const apiAddons = addonsFromApi(data?.policies?.addons);
        if (apiAddons) setAddons(apiAddons);
        if (Array.isArray(data?.protectionExclusions) && data.protectionExclusions.length) {
          setExclusionsText(data.protectionExclusions.join(' · '));
        }
      } catch (err) {
        logWarn('Failed to load policies, using fallback copy: ' + errMsg(err));
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
      setError(t('checkout.selectProtectionError'));
      return;
    }
    const infoError = validateInfo();
    if (infoError) { setError(infoError); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await api<{
        nextActions?: { link?: string }[];
        paymentLink?: string;
        portalLink?: string;
        [key: string]: unknown;
      }>('/api/public/booking/checkout', {
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
      setError(errMsg(err) || t('checkout.unableToCompleteBooking'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><Text style={styles.muted}>{t('common.loading')}</Text></View>;

  // Payment WebView
  if (step === 'payment' && paymentUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentHeaderTitle}>{t('checkout.completePayment')}</Text>
          <TouchableOpacity onPress={() => setStep(3)} accessibilityRole="button" accessibilityLabel={t('checkout.doneWithPaymentA11y')}>
            <Text style={{ color: colors.brand, fontWeight: '700' }}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={{ color: colors.muted, marginTop: spacing.md }}>{t('checkout.loadingPaymentPortal')}</Text>
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
                setError(t('checkout.paymentCancelled'));
                setStep(2);
              }
            } catch {}
          }}
          onError={() => {
            setError(t('checkout.paymentFailedToLoad'));
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
        <Text style={styles.title}>{t('checkout.bookingConfirmed')}</Text>
        <Text style={styles.subtitle}>{t('checkout.checkEmail')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/trips')} accessibilityRole="button">
          <Text style={styles.btnText}>{t('checkout.viewMyTrips')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, Number(step) >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, Number(step) >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, Number(step) >= 2 && styles.progressDotActive]} />
        </View>
        <Text style={styles.stepLabel}>{t('checkout.stepOf', { step, total: 2 })}</Text>

        {/* Vehicle summary */}
        {listing && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{listing.title || vehicleLabel(listing)}</Text>
            <Text style={styles.summaryPrice}>{fmtMoney(listing.baseDailyRate)}{t('common.perDay')}</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>{t('checkout.yourInformation')}</Text>
            <TextInput style={styles.input} placeholder={t('checkout.firstName')} placeholderTextColor={colors.muted} value={customer.firstName} onChangeText={(v) => setCustomer((c) => ({ ...c, firstName: v }))} accessibilityLabel={t('checkout.firstName')} />
            <TextInput style={styles.input} placeholder={t('checkout.lastName')} placeholderTextColor={colors.muted} value={customer.lastName} onChangeText={(v) => setCustomer((c) => ({ ...c, lastName: v }))} accessibilityLabel={t('checkout.lastName')} />
            <TextInput style={styles.input} placeholder={t('checkout.email')} placeholderTextColor={colors.muted} value={customer.email} onChangeText={(v) => setCustomer((c) => ({ ...c, email: v }))} keyboardType="email-address" autoCapitalize="none" accessibilityLabel={t('checkout.email')} />
            <TextInput style={styles.input} placeholder={t('checkout.phone')} placeholderTextColor={colors.muted} value={customer.phone} onChangeText={(v) => setCustomer((c) => ({ ...c, phone: v }))} keyboardType="phone-pad" accessibilityLabel={t('checkout.phone')} />

            <TouchableOpacity style={[styles.btn, !isInfoComplete && styles.btnDisabled]} onPress={handleContinue} disabled={!isInfoComplete} accessibilityRole="button">
              <Text style={styles.btnText}>{t('common.continue')}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>{t('checkout.reviewConfirm')}</Text>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.guest')}</Text>
              <Text style={styles.reviewValue}>{customer.firstName} {customer.lastName}</Text>
              <Text style={styles.reviewValue}>{customer.email}</Text>
            </View>

            {/* Trip Protection Tier Selection */}
            <Text style={styles.sectionTitle}>{t('checkout.tripProtection')}</Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginBottom: spacing.sm }}>{t('checkout.tripProtectionDisclaimer')}</Text>

            {tiers.map((tier) => (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierCard, protectionTier === tier.id && styles.tierCardActive]}
                onPress={() => setProtectionTier(tier.id)}
                accessibilityRole="button"
                accessibilityLabel={t('checkout.tierA11y', { label: tier.label, price: tier.price })}
                accessibilityState={{ selected: protectionTier === tier.id }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={[styles.tierRadio, protectionTier === tier.id && styles.tierRadioActive]} />
                    <Text style={{ fontWeight: '700', color: colors.ink, fontSize: fontSize.md }}>{tier.label}</Text>
                    {tier.recommended && <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '700' }}>{t('checkout.recommended')}</Text>}
                  </View>
                  <Text style={{ fontWeight: '800', color: colors.brand, fontSize: fontSize.md }}>{tier.price}</Text>
                </View>
                <Text style={{ fontSize: fontSize.sm, color: colors.muted, marginTop: 4 }}>{tier.desc}</Text>
                {tier.id !== 'BASIC' && (
                  <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{t('checkout.deductible', { value: tier.deductible })}</Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.muted }}>{t('checkout.upTo', { value: tier.limit })}</Text>
                  </View>
                )}
                {tier.id !== 'BASIC' && (
                  <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '600', marginTop: 4 }}>{t('checkout.reimbursementNote')}</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Decline with own insurance option */}
            <TouchableOpacity
              style={[styles.tierCard, declinedProtection && styles.tierCardActive, { borderColor: declinedProtection ? colors.warning : colors.border }]}
              onPress={() => { setDeclinedProtection(!declinedProtection); if (!declinedProtection) setProtectionTier('BASIC'); }}
              accessibilityRole="button"
              accessibilityLabel={t('checkout.ownInsurance')}
              accessibilityState={{ selected: declinedProtection }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.tierRadio, declinedProtection && { borderColor: colors.warning, backgroundColor: colors.warning }]} />
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: fontSize.md }}>{t('checkout.ownInsurance')}</Text>
              </View>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted, marginTop: 4 }}>{t('checkout.ownInsuranceDesc')}</Text>
              {declinedProtection && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}
                  onPress={() => setOwnInsuranceConfirmed(!ownInsuranceConfirmed)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('checkout.confirmInsuranceA11y')}
                  accessibilityState={{ checked: ownInsuranceConfirmed }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: ownInsuranceConfirmed ? colors.brand : colors.border, backgroundColor: ownInsuranceConfirmed ? colors.brand : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                    {ownInsuranceConfirmed && <Text style={{ color: colors.white, fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.ink }}>{t('checkout.confirmInsurance')}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Exclusions */}
            <View style={{ padding: spacing.md, backgroundColor: 'rgba(255,194,88,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,194,88,0.15)' }}>
              <Text style={{ fontWeight: '700', color: colors.warning, fontSize: fontSize.sm, marginBottom: spacing.xs }}>{t('checkout.notCovered')}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.muted, lineHeight: 18 }}>{exclusionsText}</Text>
            </View>

            {/* Optional Add-ons */}
            <Text style={styles.sectionTitle}>{t('checkout.optionalAddons')}</Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginBottom: spacing.sm }}>{t('checkout.addonsNote')}</Text>

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
            <Text style={styles.sectionTitle}>{t('checkout.tripPolicies')}</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.cancellation')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.cancellationPolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.mileage')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.mileagePolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.fuel')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.fuelPolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.lateReturn')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.lateReturnPolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.securityDeposit')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.securityDepositPolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.tolls')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.tollsPolicy')}</Text>
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>{t('checkout.cleaning')}</Text>
              <Text style={styles.reviewValue}>{t('checkout.cleaningPolicy')}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep(1)} accessibilityRole="button" accessibilityLabel={t('checkout.backToInfoA11y')}>
                <Text style={styles.ghostBtnText}>{t('common.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
                <Text style={styles.btnText}>{submitting ? t('checkout.confirming') : t('checkout.confirmBooking')}</Text>
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
