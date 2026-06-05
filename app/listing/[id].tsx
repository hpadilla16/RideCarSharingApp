import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';
import { fmtMoney, fmtDateTime, vehicleLabel, locationLabel } from '../../lib/format';
import { isFavorite, toggleFavorite } from '../../lib/favorites';
import { colors, spacing, fontSize } from '../../lib/theme';
import { useTranslation } from 'react-i18next';
import type { Vehicle, LocationLike } from '../../lib/format';

interface ListingHost {
  id?: string;
  displayName?: string;
  averageRating?: number | string;
  reviewCount?: number;
  [key: string]: unknown;
}

interface Listing {
  id: string;
  title?: string;
  baseDailyRate?: number | string | null;
  primaryImageUrl?: string;
  imageUrls?: string[];
  shortDescription?: string;
  instantBook?: boolean;
  vehicle?: Vehicle | null;
  location?: LocationLike | null;
  host?: ListingHost | null;
  [key: string]: unknown;
}

interface HostReview {
  id: string;
  reviewerName?: string;
  rating?: number;
  comments?: string;
}

interface HostProfile {
  reviews?: HostReview[];
  [key: string]: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ListingDetailScreen() {
  const { t } = useTranslation();
  const { id, pickupAt, returnAt } = useLocalSearchParams<{ id?: string; pickupAt?: string; returnAt?: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [faved, setFaved] = useState<boolean>(false);
  const [pickupDate, setPickupDate] = useState<Date>(() => {
    if (pickupAt) return new Date(pickupAt);
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [returnDate, setReturnDate] = useState<Date>(() => {
    if (returnAt) return new Date(returnAt);
    const d = new Date(); d.setDate(d.getDate() + 4); d.setHours(10, 0, 0, 0); return d;
  });
  const [showPickupPicker, setShowPickupPicker] = useState<boolean>(false);
  const [showReturnPicker, setShowReturnPicker] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const boot = await api<{ featuredCarSharingListings?: Listing[] }>('/api/public/booking/bootstrap');
        const featured = boot?.featuredCarSharingListings || [];
        const match = featured.find((l) => l.id === id);
        setListing(match || null);
        if (!match) setError(t('listing.notFound'));
        if (match?.id) isFavorite(match.id).then(setFaved);

        if (match?.host?.id) {
          api<HostProfile>(`/api/public/booking/hosts/${match.host.id}`).then((hp) => setHostProfile(hp)).catch(() => {});
        }
      } catch (err) {
        setError(errMsg(err) || t('listing.unableToLoad'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  if (error || !listing) return <View style={styles.center}><Text style={styles.error}>{error || t('listing.notFound')}</Text></View>;

  const images = [listing.primaryImageUrl, ...(listing.imageUrls || [])].filter(Boolean);
  const reviews = hostProfile?.reviews || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Gallery */}
      {images.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: 260 }}>
          {images.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" accessibilityLabel={t('listing.galleryPhotoA11y', { number: idx + 1, title: listing.title || vehicleLabel(listing) })} />
          ))}
        </ScrollView>
      )}

      <View style={styles.body}>
        {/* Title + Price */}
        <Text style={styles.title}>{listing.title || vehicleLabel(listing)}</Text>
        <Text style={styles.price}>{fmtMoney(listing.baseDailyRate)}{t('common.perDay')}</Text>

        {/* Vehicle info */}
        {listing.vehicle && (
          <Text style={styles.meta}>
            {[listing.vehicle.year, listing.vehicle.make, listing.vehicle.model].filter(Boolean).join(' ')}
          </Text>
        )}
        {listing.location && <Text style={styles.meta}>📍 {locationLabel(listing.location)}</Text>}

        {/* Badges */}
        <View style={styles.badgeRow}>
          {listing.instantBook && <View style={styles.badge}><Text style={styles.badgeText}>{t('listing.instantBook')}</Text></View>}
          <View style={styles.badge}><Text style={styles.badgeText}>{t('listing.tripProtection')}</Text></View>
          {Number(listing.host?.averageRating) > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>★ {Number(listing.host?.averageRating).toFixed(1)} ({listing.host?.reviewCount || 0})</Text></View>
          )}
        </View>

        {/* Host */}
        {listing.host && (
          <View style={styles.hostCard}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>{(listing.host.displayName || '?')[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.hostName}>{listing.host.displayName}</Text>
              <Text style={styles.hostMeta}>{t('listing.verifiedHost')}</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {listing.shortDescription && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('listing.aboutThisCar')}</Text>
            <Text style={styles.sectionBody}>{listing.shortDescription}</Text>
          </View>
        )}

        {/* Trip Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('listing.selectDates')}</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickupPicker(true)} accessibilityRole="button" accessibilityLabel={t('listing.pickupDateA11y', { date: pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}>
              <Text style={styles.dateLabel}>{t('listing.pickup')}</Text>
              <Text style={styles.dateValue}>{pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </TouchableOpacity>
            <Text style={styles.dateArrow}>→</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowReturnPicker(true)} accessibilityRole="button" accessibilityLabel={t('listing.returnDateA11y', { date: returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}>
              <Text style={styles.dateLabel}>{t('listing.return')}</Text>
              <Text style={styles.dateValue}>{returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const days = Math.max(1, Math.round((returnDate.getTime() - pickupDate.getTime()) / 86400000));
            return (
              <Text style={styles.dateSummary}>
                {t('listing.daysEstimate', { count: days, total: fmtMoney(Number(listing.baseDailyRate) * days) })}
              </Text>
            );
          })()}
          {showPickupPicker && (
            <DateTimePicker
              value={pickupDate}
              mode="date"
              minimumDate={new Date()}
              onChange={(e, date) => {
                setShowPickupPicker(Platform.OS === 'ios');
                if (date) {
                  setPickupDate(date);
                  if (date >= returnDate) setReturnDate(new Date(date.getTime() + 86400000));
                }
              }}
            />
          )}
          {showReturnPicker && (
            <DateTimePicker
              value={returnDate}
              mode="date"
              minimumDate={new Date(pickupDate.getTime() + 86400000)}
              onChange={(e, date) => {
                setShowReturnPicker(Platform.OS === 'ios');
                if (date) setReturnDate(date);
              }}
            />
          )}
        </View>

        {/* Cancellation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('listing.cancellationPolicy')}</Text>
          <Text style={styles.sectionBody}>{t('listing.cancellationBody')}</Text>
        </View>

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('listing.guestReviews', { count: reviews.length })}</Text>
            {reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{review.reviewerName || t('listing.guest')}</Text>
                  <Text style={{ color: '#f5a623' }}>{'★'.repeat(Math.round(review.rating || 0))}</Text>
                </View>
                {review.comments && <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>{review.comments}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Fixed Book Button */}
      <View style={styles.bookBar}>
        <TouchableOpacity onPress={async () => { const saved = await toggleFavorite(listing); setFaved(saved); }} style={{ padding: spacing.sm }} accessibilityRole="button" accessibilityLabel={faved ? t('listing.removeSavedA11y') : t('listing.saveCarA11y')} accessibilityState={{ selected: faved }}>
          <Text style={{ fontSize: 24 }}>{faved ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookPrice}>{fmtMoney(listing.baseDailyRate)}{t('common.perDay')}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => router.push({ pathname: '/checkout', params: { listingId: id, pickupAt: pickupDate.toISOString(), returnAt: returnDate.toISOString() } })}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.bookBtnText}>{t('listing.bookThisCar')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  error: { color: colors.error, fontSize: fontSize.md },
  galleryImage: { width: 360, height: 260 },
  body: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  price: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand, marginBottom: spacing.sm },
  meta: { fontSize: fontSize.sm, color: colors.muted, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(135,82,254,0.08)' },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.brand },
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: 14, marginBottom: spacing.lg, elevation: 1 },
  hostAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  hostAvatarText: { color: colors.white, fontWeight: '800', fontSize: fontSize.lg },
  hostName: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md },
  hostMeta: { fontSize: fontSize.sm, color: colors.muted },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  sectionBody: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 22 },
  reviewCard: { padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, marginBottom: spacing.sm, elevation: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtn: { flex: 1, padding: spacing.md, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  dateLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: 4 },
  dateValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink },
  dateArrow: { fontSize: fontSize.lg, color: colors.muted },
  dateSummary: { fontSize: fontSize.sm, fontWeight: '600', color: colors.brand, marginTop: spacing.sm },
  bookBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  bookPrice: { fontSize: fontSize.lg, fontWeight: '800', color: colors.ink },
  bookBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: colors.brand },
  bookBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
});
