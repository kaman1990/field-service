import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const bottomPadding = tabBarHeight + (Platform.OS !== 'web' ? insets.bottom : 0);
  
  return (
    <Stack
      screenOptions={{
        contentStyle: {
          paddingBottom: bottomPadding,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="debug"
        options={{ title: 'Database Debug' }}
      />
      <Stack.Screen
        name="sites"
        options={{ title: 'Sites Management' }}
      />
      <Stack.Screen
        name="user-sites"
        options={{ title: 'User Management' }}
      />
    </Stack>
  );
}

