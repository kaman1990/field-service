import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getPowerSync } from '../lib/powersync';
import { connectPowerSync } from '../lib/powersync';
import { PowerSyncStatus } from '../components/PowerSyncStatus';
import { UpdateBanner } from '../components/UpdateBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Import PowerSyncContext
let PowerSyncContext: any;
try {
  const powersyncReact = require('@powersync/react');
  PowerSyncContext = powersyncReact.PowerSyncContext;
} catch (error) {
  PowerSyncContext = React.createContext(null);
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const [powerSync, setPowerSync] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  // Initialize PowerSync
  useEffect(() => {
    try {
      const instance = getPowerSync();
      setPowerSync(instance);
    } catch (error) {
      setPowerSync(null);
    }
  }, []);

  // Check auth state and redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
      
      if (session) {
        connectPowerSync().catch(() => {
          // Silent fail - will retry on next auth change
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      
      if (event === 'SIGNED_IN' && session) {
        setTimeout(async () => {
          await connectPowerSync().catch(() => {
            // Silent fail
          });
        }, 500);
        router.replace('/(tabs)/machines');
      } else if (event === 'SIGNED_OUT') {
        try {
          // Get PowerSync instance directly to ensure we have it
          try {
            const powerSyncInstance = getPowerSync();
            if (powerSyncInstance) {
              // Use disconnectAndClear to properly clear the database on logout
              await powerSyncInstance.disconnectAndClear();
            }
          } catch (getInstanceError) {
            // PowerSync might not be initialized, which is fine
          }
        } catch (error) {
          // Try to disconnect even if clear fails
          try {
            const powerSyncInstance = getPowerSync();
            if (powerSyncInstance) {
              await powerSyncInstance.disconnect();
            }
          } catch (disconnectError) {
            // Error disconnecting PowerSync
          }
        }
        // Ensure navigation happens after cleanup
        setTimeout(() => {
          router.replace('/sign-in');
        }, 100);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [powerSync, router]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';
    const isIndex = !firstSegment || firstSegment === 'index';

    // Don't redirect if we're already on index (it handles its own redirect)
    if (isIndex) return;

    if (!isAuthenticated && !inAuthGroup && firstSegment !== 'sign-in') {
      router.replace('/sign-in');
    } else if (isAuthenticated && (inAuthGroup || firstSegment === 'sign-in')) {
      router.replace('/(tabs)/assets');
    }
  }, [isAuthenticated, segments, isLoading, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 12 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <PowerSyncContext.Provider value={powerSync}>
          <QueryClientProvider client={queryClient}>
            <UpdateBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            {isAuthenticated && <PowerSyncStatus />}
          </QueryClientProvider>
        </PowerSyncContext.Provider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
