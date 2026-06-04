// Secure storage for auth tokens (Keychain on iOS, Keystore on Android).
// Falls back to AsyncStorage on web where SecureStore is unavailable.
// Transparently migrates legacy plaintext AsyncStorage values.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

export async function getSecureItem(key) {
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
    console.warn(`secureStorage.get(${key}) failed:`, err?.message);
    return null;
  }
}

export async function setSecureItem(key, value) {
  try {
    if (isWeb) return await AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`secureStorage.set(${key}) failed:`, err?.message);
  }
}

export async function deleteSecureItem(key) {
  try {
    if (!isWeb) await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key); // also clears any legacy copy
  } catch (err) {
    console.warn(`secureStorage.delete(${key}) failed:`, err?.message);
  }
}
