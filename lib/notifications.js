import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from './logger';

const PUSH_TOKEN_KEY = 'ride_push_token';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ride Car Sharing',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8752FE',
    });
  }

  // SDK 49+ requires the EAS projectId explicitly.
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    logWarn('No EAS projectId in app config; cannot obtain push token');
    return null;
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  // TODO(backend): POST the token to a /api/public/booking/devices
  // endpoint once it exists, keyed by guest session, so the server can
  // actually send pushes. Tracked as backend backlog.

  const token = tokenData?.data;
  if (token) {
    try { await AsyncStorage.setItem(PUSH_TOKEN_KEY, token); } catch (err) { logWarn('Failed to persist push token: ' + (err?.message || err)); }
  }

  return token;
}

/**
 * Get stored push token.
 */
export async function getStoredPushToken() {
  try { return await AsyncStorage.getItem(PUSH_TOKEN_KEY); } catch { return null; }
}

/**
 * Schedule a local notification (for reminders).
 */
export async function scheduleLocalNotification({ title, body, data, triggerSeconds }) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: triggerSeconds ? { seconds: triggerSeconds } : null,
  });
}

/**
 * Listen for notification interactions.
 */
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Listen for incoming notifications while app is open.
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}
