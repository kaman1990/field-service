import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://xlqljnrvgvsznjbulucw.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhscWxqbnJ2Z3Zzem5qYnVsdWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0MTUzMDIsImV4cCI6MjA0NTk5MTMwMn0.V9mhv_qIZUnb0o4Kkrnumg_R-j5XI2WQVUXVfj2YMw0';

// Configure client options with connection pooling considerations
const clientOptions: any = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
};

// Only add keepalive on web platform (not supported in React Native)
// NOTE: keepalive might cause issues with large file uploads, so we'll skip it for now
// if (Platform.OS === 'web') {
//   clientOptions.global = {
//     fetch: (url: string, options: any = {}) => {
//       return fetch(url, {
//         ...options,
//         keepalive: true, // Helps reuse HTTP connections on web
//       });
//     },
//   };
// }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

