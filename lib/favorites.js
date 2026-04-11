import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'ride_favorites';

export async function getFavorites() {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function isFavorite(listingId) {
  const favs = await getFavorites();
  return favs.some((f) => f.id === listingId);
}

export async function toggleFavorite(listing) {
  const favs = await getFavorites();
  const idx = favs.findIndex((f) => f.id === listing.id);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift({
      id: listing.id,
      title: listing.title || '',
      baseDailyRate: listing.baseDailyRate || 0,
      primaryImageUrl: listing.primaryImageUrl || listing.imageUrls?.[0] || '',
      vehicleLabel: listing.vehicle ? [listing.vehicle.year, listing.vehicle.make, listing.vehicle.model].filter(Boolean).join(' ') : '',
      savedAt: new Date().toISOString(),
    });
  }
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.slice(0, 50)));
  return idx < 0; // true if added
}
