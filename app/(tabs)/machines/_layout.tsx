import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MachinesLayout() {
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
        options={{ title: 'Machines' }}
      />
      <Stack.Screen
        name="[assetId]"
        options={{ title: 'Machine Details' }}
      />
      <Stack.Screen
        name="[assetId]/edit"
        options={{ title: 'Edit Machine' }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Machine' }}
      />
      <Stack.Screen
        name="points/index"
        options={{ title: 'Points' }}
      />
      <Stack.Screen
        name="points/[pointId]"
        options={{ title: 'Point Details' }}
      />
      <Stack.Screen
        name="points/[pointId]/edit"
        options={{ title: 'Edit Point' }}
      />
      <Stack.Screen
        name="points/new"
        options={{ title: 'New Point' }}
      />
    </Stack>
  );
}

