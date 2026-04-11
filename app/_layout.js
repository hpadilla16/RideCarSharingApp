import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useThemeColors } from '../lib/theme';

export default function AppLayout() {
  const scheme = useColorScheme();
  const c = useThemeColors();
  return (
    <>
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
        <Tabs.Screen
          name="inspection"
          options={{
            href: null,
            title: 'Inspection',
          }}
        />
      </Tabs>
    </>
  );
}
