// Secure storage for auth tokens (Keychain on iOS, Keystore on Android).
// Falls back to AsyncStorage on web where SecureStore is unavailable.
// Transparently migrates legacy plaintext AsyncStorage values.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from './logger';

const isWeb = Platform.OS === 'web';

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(key);
    let value = await SecureStore.getItemAsync(key);
    if (value == null) {
      // One-time migration from legacy AsyncStorage storage.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
        value = legacy;
      }
    }
    return value;
  } catch (err) {
    logWarn(`secureStorage.get(${key}) failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    logWarn(`secureStorage.set(${key}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (!isWeb) await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key); // also clears any legacy copy
  } catch (err) {
    logWarn(`secureStorage.delete(${key}) failed: ${err instanceof Error ? err.message : err}`);
  }
}
