import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel, locationLabel } from '../lib/format';
import { getFavorites } from '../lib/favorites';
import { colors, spacing, fontSize } from '../lib/theme';

export default function ExploreScreen() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [favorites, setFavorites] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    // Load favorites
    getFavorites().then(setFavorites);
    // Request location
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation(loc.coords);
        } else {
          setLocationDenied(true);
        }
      } catch { setLocationDenied(true); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/public/booking/bootstrap');
        setBootstrap(data);
        setListings(data?.featuredCarSharingListings || []);
      } catch (err) {
        setError(err?.message || 'Unable to load listings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredListings = listings.filter((l) => {
    if (filter === 'INSTANT') return l.instantBook;
    if (filter === 'DELIVERY') return l.fulfillmentMode === 'DELIVERY_ONLY' || l.fulfillmentMode === 'PICKUP_OR_DELIVERY' || l.deliveryAvailable;
    return true;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Loading car sharing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Find your perfect ride</Text>
        <Text style={styles.heroSubtitle}>Browse locally hosted vehicles with trip protection on every booking.</Text>
        <TouchableOpacity
          style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' }}
          onPress={() => router.push('/map')}
        >
          <Text style={{ fontSize: fontSize.md }}>🗺</Text>
          <Text style={{ fontWeight: '700', color: colors.brand, fontSize: fontSize.sm }}>View Map</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Location status */}
      {userLocation && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '600' }}>📍 Location enabled — showing cars near you</Text>
        </View>
      )}

      {/* Saved favorites */}
      {favorites.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ paddingHorizontal: spacing.lg, fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm }}>❤️ Saved Cars</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {favorites.map((fav) => (
              <TouchableOpacity key={fav.id} style={{ width: 160, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden', elevation: 1 }} onPress={() => router.push(`/listing/${fav.id}`)}>
                {fav.primaryImageUrl ? (
                  <Image source={{ uri: fav.primaryImageUrl }} style={{ width: 160, height: 90 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: 160, height: 90, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.muted, fontSize: fontSize.xs }}>No Photo</Text></View>
                )}
                <View style={{ padding: spacing.sm }}>
                  <Text style={{ fontWeight: '600', color: colors.ink, fontSize: fontSize.xs }} numberOfLines={1}>{fav.title || fav.vehicleLabel}</Text>
                  <Text style={{ fontWeight: '700', color: colors.brand, fontSize: fontSize.xs }}>{fmtMoney(fav.baseDailyRate)}/day</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterRow}>
        {['ALL', 'INSTANT', 'DELIVERY'].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? 'All Cars' : f === 'INSTANT' ? 'Instant Book' : 'Delivery'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listings */}
      {filteredListings.length === 0 && !loading && (
        <Text style={styles.empty}>No listings found. Try a different filter.</Text>
      )}

      {filteredListings.map((listing) => (
        <TouchableOpacity
          key={listing.id}
          style={styles.card}
          onPress={() => router.push(`/listing/${listing.id}`)}
          activeOpacity={0.7}
        >
          {listing.primaryImageUrl || listing.imageUrls?.[0] ? (
            <Image
              source={{ uri: listing.primaryImageUrl || listing.imageUrls[0] }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: colors.muted }}>No Photo</Text>
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{listing.title || vehicleLabel(listing)}</Text>
            <Text style={styles.cardMeta}>
              {listing.host?.displayName ? `Hosted by ${listing.host.displayName}` : ''}
              {listing.location ? ` · ${locationLabel(listing.location)}` : ''}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardPrice}>{fmtMoney(listing.baseDailyRate)}/day</Text>
              <View style={styles.badges}>
                {listing.instantBook && <Text style={styles.badge}>Instant Book</Text>}
                {listing.host?.averageRating > 0 && (
                  <Text style={styles.badgeRating}>★ {Number(listing.host.averageRating).toFixed(1)}</Text>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: spacing.md, color: colors.muted, fontSize: fontSize.md },
  hero: { padding: spacing.lg, paddingTop: spacing.xl },
  heroTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.ink, marginBottom: spacing.xs },
  heroSubtitle: { fontSize: fontSize.md, color: colors.muted, lineHeight: 22 },
  error: { color: colors.error, padding: spacing.lg, fontSize: fontSize.sm },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  filterBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.white },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl, fontSize: fontSize.md },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: spacing.md },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  cardMeta: { fontSize: fontSize.sm, color: colors.muted, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand },
  badges: { flexDirection: 'row', gap: spacing.xs },
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(135,82,254,0.1)', color: colors.brand, fontSize: fontSize.xs, fontWeight: '700', overflow: 'hidden' },
  badgeRating: { fontSize: fontSize.xs, fontWeight: '700', color: '#f5a623' },
});
