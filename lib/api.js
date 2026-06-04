import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { getSecureItem, setSecureItem, deleteSecureItem } from './secureStorage';

export const GUEST_TOKEN_KEY = 'ride_guest_token';
export const GUEST_CUSTOMER_KEY = 'ride_guest_customer';

export async function api(path, opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };

  // Attach guest token if available
  const guestToken = await getSecureItem(GUEST_TOKEN_KEY);
  if (guestToken) headers['X-Guest-Token'] = guestToken;

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { ...opts, method, headers });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function storeGuestSession(token, customer) {
  try {
    await setSecureItem(GUEST_TOKEN_KEY, token);
    // Customer profile is not a credential; AsyncStorage is fine here.
    if (customer) await AsyncStorage.setItem(GUEST_CUSTOMER_KEY, JSON.stringify(customer));
  } catch (err) {
    console.warn('storeGuestSession failed:', err?.message);
  }
}

export async function readGuestSession() {
  try {
    const token = await getSecureItem(GUEST_TOKEN_KEY);
    const raw = await AsyncStorage.getItem(GUEST_CUSTOMER_KEY);
    return { token, customer: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, customer: null };
  }
}

export async function clearGuestSession() {
  try {
    await deleteSecureItem(GUEST_TOKEN_KEY);
    await AsyncStorage.removeItem(GUEST_CUSTOMER_KEY);
  } catch (err) {
    console.warn('clearGuestSession failed:', err?.message);
  }
}
