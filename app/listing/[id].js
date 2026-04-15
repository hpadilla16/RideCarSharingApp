import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';
import { fmtMoney, fmtDateTime, vehicleLabel, locationLabel } from '../../lib/format';
import { isFavorite, toggleFavorite } from '../../lib/favorites';
import { colors, spacing, fontSize } from '../../lib/theme';

export default function ListingDetailScreen() {
  const { id, pickupAt, returnAt } = useLocalSearchParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [hostProfile, setHostProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [faved, setFaved] = useState(false);
  const [pickupDate, setPickupDate] = useState(() => {
    if (pickupAt) return new Date(pickupAt);
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [returnDate, setReturnDate] = useState(() => {
    if (returnAt) return new Date(returnAt);
    const d = new Date(); d.setDate(d.getDate() + 4); d.setHours(10, 0, 0, 0); return d;
  });
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const boot = await api('/api/public/booking/bootstrap');
        const featured = boot?.featuredCarSharingListings || [];
        const match = featured.find((l) => l.id === id);
        setListing(match || null);
        if (!match) setError('Listing not found');
        if (match?.id) isFavorite(match.id).then(setFaved);

        if (match?.host?.id) {
          api(`/api/public/booking/hosts/${match.host.id}`).then((hp) => setHostProfile(hp)).catch(() => {});
        }
      } catch (err) {
        setError(err?.message || 'Unable to load listing');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  if (error || !listing) return <View style={styles.center}><Text style={styles.error}>{error || 'Listing not found'}</Text></View>;

  const images = [listing.primaryImageUrl, ...(listing.imageUrls || [])].filter(Boolean);
  const reviews = hostProfile?.reviews || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Gallery */}
      {images.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: 260 }}>
          {images.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      <View style={styles.body}>
        {/* Title + Price */}
        <Text style={styles.title}>{listing.title || vehicleLabel(listing)}</Text>
        <Text style={styles.price}>{fmtMoney(listing.baseDailyRate)}/day</Text>

        {/* Vehicle info */}
        {listing.vehicle && (
          <Text style={styles.meta}>
            {[listing.vehicle.year, listing.vehicle.make, listing.vehicle.model].filter(Boolean).join(' ')}
          </Text>
        )}
        {listing.location && <Text style={styles.meta}>📍 {locationLabel(listing.location)}</Text>}

        {/* Badges */}
        <View style={styles.badgeRow}>
          {listing.instantBook && <View style={styles.badge}><Text style={styles.badgeText}>⚡ Instant Book</Text></View>}
          <View style={styles.badge}><Text style={styles.badgeText}>🛡 Trip Protection</Text></View>
          {listing.host?.averageRating > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>★ {Number(listing.host.averageRating).toFixed(1)} ({listing.host.reviewCount || 0})</Text></View>
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
              <Text style={styles.hostMeta}>Verified host</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {listing.shortDescription && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this car</Text>
            <Text style={styles.sectionBody}>{listing.shortDescription}</Text>
          </View>
        )}

        {/* Trip Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Dates</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickupPicker(true)}>
              <Text style={styles.dateLabel}>Pickup</Text>
              <Text style={styles.dateValue}>{pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </TouchableOpacity>
            <Text style={styles.dateArrow}>→</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowReturnPicker(true)}>
              <Text style={styles.dateLabel}>Return</Text>
              <Text style={styles.dateValue}>{returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const days = Math.max(1, Math.round((returnDate - pickupDate) / 86400000));
            return (
              <Text style={styles.dateSummary}>
                {days} day{days !== 1 ? 's' : ''} · Est. {fmtMoney(Number(listing.baseDailyRate) * days)}
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
          <Text style={styles.sectionTitle}>Cancellation Policy</Text>
          <Text style={styles.sectionBody}>Free cancellation up to 24 hours before pickup. Late cancellations may incur a fee.</Text>
        </View>

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Guest Reviews ({reviews.length})</Text>
            {reviews.slice(0, 5).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{review.reviewerName || 'Guest'}</Text>
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
        <TouchableOpacity onPress={async () => { const saved = await toggleFavorite(listing); setFaved(saved); }} style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 24 }}>{faved ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookPrice}>{fmtMoney(listing.baseDailyRate)}/day</Text>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => router.push({ pathname: '/checkout', params: { listingId: id, pickupAt: pickupDate.toISOString(), returnAt: returnDate.toISOString() } })}
          activeOpacity={0.8}
        >
          <Text style={styles.bookBtnText}>Book This Car</Text>
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
