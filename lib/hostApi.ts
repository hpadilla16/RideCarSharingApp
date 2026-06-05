import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import type { ApiError } from './api';
import { getSecureItem, setSecureItem, deleteSecureItem } from './secureStorage';

export const HOST_TOKEN_KEY = 'ride_host_token';
export const HOST_USER_KEY = 'ride_host_user';

export interface HostUser {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface HostSession {
  token: string | null;
  user: HostUser | null;
}

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

export async function hostApi<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = String(opts.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = await getSecureItem(HOST_TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = `${API_BASE}/api/host-app${path}`;
  const res = await fetch(url, { ...opts, method, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
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

export async function hostLogin(
  email: string,
  password: string
): Promise<{ token?: string; user?: HostUser }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    let msg = 'Invalid email or password';
    try {
      const d = await res.json();
      if (d?.error) msg = d.error;
    } catch {
      // body wasn't JSON — keep the default message
    }
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.token) await setSecureItem(HOST_TOKEN_KEY, data.token);
  // User profile is not a credential; AsyncStorage is fine here.
  if (data.user) await AsyncStorage.setItem(HOST_USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function readHostSession(): Promise<HostSession> {
  try {
    const token = await getSecureItem(HOST_TOKEN_KEY);
    const raw = await AsyncStorage.getItem(HOST_USER_KEY);
    return { token, user: raw ? JSON.parse(raw) : null };
  } catch {
    return { token: null, user: null };
  }
}

export async function clearHostSession(): Promise<void> {
  await deleteSecureItem(HOST_TOKEN_KEY);
  await AsyncStorage.removeItem(HOST_USER_KEY);
}
