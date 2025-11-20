import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // User is authenticated, redirect to dashboard
          router.replace('/(tabs)/dashboard');
        } else {
          // User is not authenticated, redirect to sign-in
          router.replace('/sign-in');
        }
      } catch (error) {
        console.error('[Index] Error checking auth:', error);
        router.replace('/sign-in');
      }
    };

    checkAuthAndRedirect();
  }, []);

  // Show loading while checking auth
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={{ marginTop: 12 }}>Loading...</Text>
    </View>
  );
}

