import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { logWarn } from './logger';
import { getSecureItem, setSecureItem, deleteSecureItem } from './secureStorage';

export const GUEST_TOKEN_KEY = 'ride_guest_token';
export const GUEST_CUSTOMER_KEY = 'ride_guest_customer';

export interface ApiError extends Error {
  status?: number;
}

export interface GuestCustomer {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

export interface GuestSession {
  token: string | null;
  customer: GuestCustomer | null;
}

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = String(opts.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };

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
    } catch {
      // body wasn't JSON — keep the status-based message
    }
    const err: ApiError = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export async function storeGuestSession(token: string, customer?: GuestCustomer | null): Promise<void> {
  try {
    await setSecureItem(GUEST_TOKEN_KEY, token);
    // Customer profile is not a credential; AsyncStorage is fine here.
    if (customer) await AsyncStorage.setItem(GUEST_CUSTOMER_KEY, JSON.stringify(customer));
  } catch (err) {
    logWarn(`storeGuestSession failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function readGuestSession(): Promise<GuestSession> {
  try {
    const token = await getSecureItem(GUEST_TOKEN_KEY);
    const raw = await AsyncStorage.getItem(GUEST_CUSTOMER_KEY);
    return { token, customer: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, customer: null };
  }
}

export async function clearGuestSession(): Promise<void> {
  try {
    await deleteSecureItem(GUEST_TOKEN_KEY);
    await AsyncStorage.removeItem(GUEST_CUSTOMER_KEY);
  } catch (err) {
    logWarn(`clearGuestSession failed: ${err instanceof Error ? err.message : err}`);
  }
}
