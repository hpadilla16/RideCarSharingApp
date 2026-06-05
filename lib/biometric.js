import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from './logger';

const BIOMETRIC_ENABLED_KEY = 'ride_biometric_enabled';

export async function isBiometricAvailable() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch { return false; }
}

export async function isBiometricEnabled() {
  try {
    const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  } catch { return false; }
}

export async function setBiometricEnabled(enabled) {
  try {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) { logWarn('Failed to save biometric preference: ' + (err?.message || err)); }
}

export async function authenticateWithBiometric(promptMessage = 'Verify your identity') {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch { return false; }
}

export async function getSupportedTypes() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.map((t) => {
      if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'fingerprint';
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'face';
      if (t === LocalAuthentication.AuthenticationType.IRIS) return 'iris';
      return 'unknown';
    });
  } catch { return []; }
}
