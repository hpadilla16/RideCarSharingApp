import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { fmtMoney, vehicleLabel } from '../lib/format';
import { colors, spacing, fontSize } from '../lib/theme';
import { logError, logWarn } from '../lib/logger';

const { width, height } = Dimensions.get('window');

const DEFAULT_REGION = {
  latitude: 18.4655,
  longitude: -66.1057,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function MapScreen() {
  const router = useRouter();
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Get user location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          });
        }
      } catch (err) { logWarn('Location unavailable: ' + (err?.message || err)); }

      // Load listings
      try {
        const data = await api('/api/public/booking/bootstrap');
        const all = data?.featuredCarSharingListings || [];
        // Filter listings that have location coords
        const withCoords = all.filter((l) => l.location?.latitude && l.location?.longitude);
        // If no coords, place them near the default region with slight offsets
        const mapped = all.map((l, idx) => ({
          ...l,
          _lat: l.location?.latitude || (DEFAULT_REGION.latitude + (Math.random() - 0.5) * 0.08),
          _lng: l.location?.longitude || (DEFAULT_REGION.longitude + (Math.random() - 0.5) * 0.08),
        }));
        setListings(mapped);
      } catch (err) { logError(err, { screen: 'map' }); }
      setLoading(false);
    })();
  }, []);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      )}

      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {listings.map((listing) => (
          <Marker
            key={listing.id}
            coordinate={{ latitude: listing._lat, longitude: listing._lng }}
            pinColor={colors.brand}
          >
            <Callout onPress={() => router.push(`/listing/${listing.id}`)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={1}>{listing.title || vehicleLabel(listing)}</Text>
                <Text style={styles.calloutPrice}>{fmtMoney(listing.baseDailyRate)}/day</Text>
                {listing.instantBook && <Text style={styles.calloutBadge}>⚡ Instant Book</Text>}
                <Text style={styles.calloutCta}>Tap to view →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Bottom card: count */}
      <View style={styles.bottomCard}>
        <Text style={styles.bottomText}>{listings.length} cars near you</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.bottomLink}>List view</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height - 80 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.7)' },
  callout: { width: 180, padding: spacing.sm },
  calloutTitle: { fontWeight: '700', color: colors.ink, fontSize: fontSize.sm, marginBottom: 2 },
  calloutPrice: { fontWeight: '800', color: colors.brand, fontSize: fontSize.md, marginBottom: 4 },
  calloutBadge: { fontSize: fontSize.xs, color: colors.brand, fontWeight: '600' },
  calloutCta: { fontSize: fontSize.xs, color: colors.muted, marginTop: 4 },
  bottomCard: { position: 'absolute', bottom: 20, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.card, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  bottomText: { fontWeight: '700', color: colors.ink, fontSize: fontSize.md },
  bottomLink: { color: colors.brand, fontWeight: '700', fontSize: fontSize.sm },
});
