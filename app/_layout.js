import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/theme';
import { registerForPushNotifications, addNotificationResponseListener } from '../lib/notifications';
import { shouldShowOnboarding } from './onboarding';
import ErrorBoundary from '../components/ErrorBoundary';
import '../lib/i18n';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const c = useThemeColors();
  const router = useRouter();

  useEffect(() => {
    shouldShowOnboarding().then((show) => {
      if (show) router.replace('/onboarding');
    });
    registerForPushNotifications();
    const subscription = addNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.chatToken) router.push(`/chat/${data.chatToken}`);
      else if (data?.tripId) router.push('/trips');
    });
    return () => subscription?.remove();
  }, []);
  return (
    <ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.ink,
          headerTitleStyle: { fontWeight: '700' },
          tabBarActiveTintColor: c.brand,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('layout.explore'),
            tabBarLabel: t('layout.explore'),
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: t('layout.myTrips'),
            tabBarLabel: t('layout.trips'),
            tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: t('layout.account'),
            tabBarLabel: t('layout.account'),
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="listing/[id]" options={{ href: null, title: t('layout.listing') }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: t('layout.checkout') }} />
        <Tabs.Screen name="login" options={{ href: null, title: t('common.signIn') }} />
        <Tabs.Screen name="chat/[token]" options={{ href: null, title: t('layout.tripChat') }} />
        <Tabs.Screen name="issue" options={{ href: null, title: t('layout.reportIssue') }} />
        <Tabs.Screen name="review" options={{ href: null, title: t('layout.review') }} />
        <Tabs.Screen name="inspection" options={{ href: null, title: t('layout.inspection') }} />
        <Tabs.Screen name="documents" options={{ href: null, title: t('layout.documents') }} />
        <Tabs.Screen name="map" options={{ href: null, title: t('layout.map'), headerShown: false }} />
        <Tabs.Screen name="onboarding" options={{ href: null, title: t('layout.welcome'), headerShown: false }} />
        <Tabs.Screen name="host/index" options={{ href: null, title: t('layout.hostDashboard') }} />
        <Tabs.Screen name="host/login" options={{ href: null, title: t('layout.hostLogin') }} />
        <Tabs.Screen name="host/trips" options={{ href: null, title: t('layout.hostTrips') }} />
        <Tabs.Screen name="host/earnings" options={{ href: null, title: t('layout.hostEarnings') }} />
        <Tabs.Screen name="host/listings" options={{ href: null, title: t('layout.hostListings') }} />
      </Tabs>
    </ErrorBoundary>
  );
}
