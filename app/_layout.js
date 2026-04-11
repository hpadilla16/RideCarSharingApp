import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../lib/theme';

export default function AppLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Explore',
            tabBarLabel: 'Explore',
            tabBarIcon: () => null,
            headerTitle: 'Ride Car Sharing',
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'My Trips',
            tabBarLabel: 'Trips',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarLabel: 'Account',
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="listing/[id]"
          options={{
            href: null, // hidden from tabs
            title: 'Listing',
          }}
        />
        <Tabs.Screen
          name="checkout"
          options={{
            href: null,
            title: 'Checkout',
          }}
        />
        <Tabs.Screen
          name="login"
          options={{
            href: null,
            title: 'Sign In',
          }}
        />
        <Tabs.Screen
          name="chat/[token]"
          options={{
            href: null,
            title: 'Trip Chat',
          }}
        />
        <Tabs.Screen
          name="issue"
          options={{
            href: null,
            title: 'Report Issue',
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            href: null,
            title: 'Review',
          }}
        />
      </Tabs>
    </>
  );
}
