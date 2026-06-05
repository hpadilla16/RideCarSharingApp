import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel, locationLabel } from '../lib/format';
import { getFavorites } from '../lib/favorites';
import { colors, spacing, fontSize } from '../lib/theme';
import { useTranslation } from 'react-i18next';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiParsed, setAiParsed] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  // Date-based search
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 4); d.setHours(10, 0, 0, 0); return d;
  });
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [datesSearched, setDatesSearched] = useState(false);

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

  async function loadBootstrap() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/public/booking/bootstrap');
      setBootstrap(data);
      setListings(data?.featuredCarSharingListings || []);
    } catch (err) {
      setError(err?.message || t('explore.unableToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  async function handleDateSearch() {
    setSearching(true);
    setError('');
    try {
      // Get location IDs from bootstrap data
      const locationIds = (bootstrap?.locations || []).map((l) => l.id).filter(Boolean);
      const searchPlaceIds = (bootstrap?.carSharingSearchPlaces || []).map((p) => p.id).filter(Boolean);
      const body = {
        pickupAt: pickupDate.toISOString(),
        returnAt: returnDate.toISOString(),
      };
      if (locationIds.length > 0) body.locationIds = locationIds;
      if (searchPlaceIds.length > 0) body.searchPlaceIds = searchPlaceIds;
      // Need at least one location param
      if (!locationIds.length && !searchPlaceIds.length) {
        // Fallback: just show featured listings filtered client-side
        setDatesSearched(true);
        setSearching(false);
        return;
      }
      const results = await api('/api/public/booking/car-sharing-search', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setListings(Array.isArray(results) ? results : results?.listings || results?.results || []);
      setDatesSearched(true);
    } catch (err) {
      // Fallback to featured listings if search fails
      setListings(bootstrap?.featuredCarSharingListings || []);
      setError(t('explore.searchUnavailable'));
      setDatesSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleAiSearch() {
    if (!searchQuery.trim()) { setAiParsed(null); return; }
    setSearching(true);
    try {
      const intent = await api('/api/public/booking/ai-search/intent', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      setAiParsed(intent);
    } catch {
      setAiParsed(null);
    } finally {
      setSearching(false);
    }
  }

  const filteredListings = listings.filter((l) => {
    // Filter tab
    if (filter === 'INSTANT' && !l.instantBook) return false;
    if (filter === 'DELIVERY' && l.fulfillmentMode !== 'DELIVERY_ONLY' && l.fulfillmentMode !== 'PICKUP_OR_DELIVERY' && !l.deliveryAvailable) return false;

    // AI search filters
    if (aiParsed && !aiParsed.fallback) {
      if (aiParsed.vehicleType) {
        const vt = String(aiParsed.vehicleType).toLowerCase();
        const title = String(l.title || '').toLowerCase();
        const make = String(l.vehicle?.make || '').toLowerCase();
        const model = String(l.vehicle?.model || '').toLowerCase();
        if (!title.includes(vt) && !make.includes(vt) && !model.includes(vt)) return false;
      }
      if (aiParsed.maxPrice && Number(l.baseDailyRate) > Number(aiParsed.maxPrice)) return false;
      if (aiParsed.instantBook === true && !l.instantBook) return false;
    }

    // Text search fallback
    if (aiParsed?.fallback && aiParsed.query) {
      const q = aiParsed.query.toLowerCase();
      const text = `${l.title || ''} ${l.vehicle?.make || ''} ${l.vehicle?.model || ''} ${l.host?.displayName || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>{t('explore.loadingCarSharing')}</Text>
      </View>
    );
  }

  // Bootstrap failed entirely (offline / server down) — show retry.
  if (!bootstrap && error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
        <Text style={[styles.loadingText, { marginBottom: spacing.lg }]}>
          {error.includes('Network') || error.includes('fetch') ? t('explore.cantConnect') : error}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadBootstrap} accessibilityRole="button">
          <Text style={styles.retryBtnText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderListing = ({ item: listing }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: `/listing/${listing.id}`, params: { pickupAt: pickupDate.toISOString(), returnAt: returnDate.toISOString() } })}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('explore.viewListing', { title: listing.title || vehicleLabel(listing) })}
    >
      {listing.primaryImageUrl || listing.imageUrls?.[0] ? (
        <Image
          source={{ uri: listing.primaryImageUrl || listing.imageUrls[0] }}
          style={styles.cardImage}
          resizeMode="cover"
          accessibilityLabel={t('explore.photoOf', { title: listing.title || vehicleLabel(listing) })}
        />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: colors.muted }}>{t('explore.noPhoto')}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{listing.title || vehicleLabel(listing)}</Text>
        <Text style={styles.cardMeta}>
          {listing.host?.displayName ? t('explore.hostedBy', { name: listing.host.displayName }) : ''}
          {listing.location ? ` · ${locationLabel(listing.location)}` : ''}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{fmtMoney(listing.baseDailyRate)}{t('common.perDay')}</Text>
          <View style={styles.badges}>
            {listing.instantBook && <Text style={styles.badge}>{t('explore.instantBook')}</Text>}
            {listing.host?.averageRating > 0 && (
              <Text style={styles.badgeRating}>★ {Number(listing.host.averageRating).toFixed(1)}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      data={filteredListings}
      keyExtractor={(l) => String(l.id)}
      renderItem={renderListing}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      ListEmptyComponent={<Text style={styles.empty}>{t('explore.noCarsAvailable')}</Text>}
      ListHeaderComponent={
        <>
      {/* Hero */}
      <LinearGradient
        colors={['#1a1340', '#2d1f6e', '#8752FE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Logo lockup */}
        <View style={styles.logoBadge}>
          <Ionicons name="car-sport" size={20} color="#fff" />
          <Text style={styles.logoText}>Ride</Text>
        </View>

        <Text style={styles.heroTitle}>{t('explore.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>
          {t('explore.heroSubtitle')}
        </Text>

        {/* Date pickers */}
        <View style={styles.dateCard}>
          <TouchableOpacity style={styles.dateField} onPress={() => setShowPickupPicker(true)} accessibilityRole="button" accessibilityLabel={t('explore.pickupDateA11y', { date: pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) })}>
            <Ionicons name="calendar-outline" size={16} color="#8752FE" />
            <View>
              <Text style={styles.dateFieldLabel}>{t('explore.pickup')}</Text>
              <Text style={styles.dateFieldValue}>
                {pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.dateDivider} />
          <TouchableOpacity style={styles.dateField} onPress={() => setShowReturnPicker(true)} accessibilityRole="button" accessibilityLabel={t('explore.returnDateA11y', { date: returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) })}>
            <Ionicons name="calendar-outline" size={16} color="#8752FE" />
            <View>
              <Text style={styles.dateFieldLabel}>{t('explore.return')}</Text>
              <Text style={styles.dateFieldValue}>
                {returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateSearchBtn} onPress={handleDateSearch} accessibilityRole="button" accessibilityLabel={t('explore.searchDatesA11y')}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        {showPickupPicker && (
          <DateTimePicker
            value={pickupDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(e, date) => {
              setShowPickupPicker(Platform.OS === 'ios');
              if (date) {
                date.setHours(10, 0, 0, 0);
                setPickupDate(date);
                if (date >= returnDate) {
                  const r = new Date(date); r.setDate(r.getDate() + 3); r.setHours(10, 0, 0, 0);
                  setReturnDate(r);
                }
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
              if (date) { date.setHours(10, 0, 0, 0); setReturnDate(date); }
            }}
          />
        )}
        <Text style={styles.dateTripLength}>
          {t('explore.dayTrip', { count: Math.round((returnDate - pickupDate) / 86400000) })}
        </Text>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.muted} style={{ marginLeft: spacing.md }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('explore.searchPlaceholder')}
              placeholderTextColor="rgba(107,122,154,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleAiSearch}
              returnKeyType="search"
              accessibilityLabel={t('explore.searchPlaceholder')}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleAiSearch} accessibilityRole="button" accessibilityLabel={t('explore.search')}>
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* AI parsed badge */}
        {aiParsed && !aiParsed.fallback && (
          <View style={styles.aiRow}>
            {aiParsed.vehicleType && <Text style={styles.aiBadgeHero}>{aiParsed.vehicleType}</Text>}
            {aiParsed.location && <Text style={styles.aiBadgeHero}>{aiParsed.location}</Text>}
            {aiParsed.pickupDate && <Text style={styles.aiBadgeHero}>{aiParsed.pickupDate}</Text>}
            {aiParsed.maxPrice && <Text style={styles.aiBadgeHero}>{'<'}${aiParsed.maxPrice}/day</Text>}
            {aiParsed.instantBook && <Text style={styles.aiBadgeHero}>{t('explore.instant')}</Text>}
            <TouchableOpacity onPress={() => { setAiParsed(null); setSearchQuery(''); }} accessibilityRole="button" accessibilityLabel={t('explore.clearFiltersA11y')}>
              <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>{t('explore.clear')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/map')} accessibilityRole="button">
            <Ionicons name="map-outline" size={16} color="#fff" />
            <Text style={styles.quickBtnText}>{t('explore.mapView')}</Text>
          </TouchableOpacity>
          <View style={styles.quickBtn}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#1fc7aa" />
            <Text style={styles.quickBtnText}>{t('explore.tripProtection')}</Text>
          </View>
          <View style={styles.quickBtn}>
            <Ionicons name="flash-outline" size={16} color="#fbbf24" />
            <Text style={styles.quickBtnText}>{t('explore.instantBook')}</Text>
          </View>
        </View>
      </LinearGradient>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Location status */}
      {userLocation && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '600' }}>{t('explore.locationEnabled')}</Text>
        </View>
      )}

      {/* Saved favorites */}
      {favorites.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ paddingHorizontal: spacing.lg, fontSize: fontSize.md, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm }}>{t('explore.savedCars')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {favorites.map((fav) => (
              <TouchableOpacity key={fav.id} style={{ width: 160, borderRadius: 12, backgroundColor: colors.card, overflow: 'hidden', elevation: 1 }} onPress={() => router.push(`/listing/${fav.id}`)} accessibilityRole="button" accessibilityLabel={t('explore.viewSavedCar', { title: fav.title || fav.vehicleLabel })}>
                {fav.primaryImageUrl ? (
                  <Image source={{ uri: fav.primaryImageUrl }} style={{ width: 160, height: 90 }} resizeMode="cover" accessibilityLabel={t('explore.photoOf', { title: fav.title || fav.vehicleLabel })} />
                ) : (
                  <View style={{ width: 160, height: 90, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.muted, fontSize: fontSize.xs }}>{t('explore.noPhoto')}</Text></View>
                )}
                <View style={{ padding: spacing.sm }}>
                  <Text style={{ fontWeight: '600', color: colors.ink, fontSize: fontSize.xs }} numberOfLines={1}>{fav.title || fav.vehicleLabel}</Text>
                  <Text style={{ fontWeight: '700', color: colors.brand, fontSize: fontSize.xs }}>{fmtMoney(fav.baseDailyRate)}{t('common.perDay')}</Text>
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
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? t('explore.allCars') : f === 'INSTANT' ? t('explore.instantBook') : t('explore.delivery')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listings header */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: '800', color: colors.ink }}>
          {datesSearched ? t('explore.availableCars') : t('explore.featuredCars')}
        </Text>
        {datesSearched && (
          <Text style={{ fontSize: fontSize.xs, color: colors.muted, marginTop: 2 }}>
            {pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {returnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {t('explore.resultCount', { count: filteredListings.length })}
          </Text>
        )}
      </View>

        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: spacing.md, color: colors.muted, fontSize: fontSize.md, textAlign: 'center', paddingHorizontal: spacing.xl },
  retryBtn: { height: 48, paddingHorizontal: 32, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },

  // Premium hero
  hero: { paddingHorizontal: spacing.lg, paddingTop: 48, paddingBottom: spacing.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, marginBottom: spacing.lg },
  logoText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { fontSize: 34, fontWeight: '900', color: '#fff', lineHeight: 40, marginBottom: spacing.sm },
  heroSubtitle: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.75)', lineHeight: 22, marginBottom: spacing.lg },

  // Date card
  dateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 5 },
  dateField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
  dateFieldLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateFieldValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.ink },
  dateDivider: { width: 1, height: 32, backgroundColor: colors.border },
  dateSearchBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#8752FE', justifyContent: 'center', alignItems: 'center', marginRight: 2 },
  dateTripLength: { fontSize: fontSize.xs, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: spacing.md, marginLeft: 4 },

  // Search
  searchContainer: { marginBottom: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, height: 52, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  searchInput: { flex: 1, height: 52, paddingHorizontal: spacing.sm, fontSize: fontSize.sm, color: colors.ink },
  searchBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#8752FE', justifyContent: 'center', alignItems: 'center', marginRight: 6 },

  // AI row
  aiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  aiBadgeHero: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: fontSize.xs, fontWeight: '600', overflow: 'hidden' },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  quickBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '600' },

  error: { color: colors.error, padding: spacing.lg, fontSize: fontSize.sm },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  filterBtn: { paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  filterBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.white },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl, fontSize: fontSize.md },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: 16, backgroundColor: colors.card, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: spacing.md },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  cardMeta: { fontSize: fontSize.sm, color: colors.muted, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand },
  badges: { flexDirection: 'row', gap: spacing.xs },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(135,82,254,0.08)', color: colors.brand, fontSize: fontSize.xs, fontWeight: '700', overflow: 'hidden' },
  badgeRating: { fontSize: fontSize.xs, fontWeight: '700', color: '#f5a623' },
});
