import { Stack } from 'expo-router';

export default function AssetsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Assets' }}
      />
      <Stack.Screen
        name="[assetId]"
        options={{ title: 'Asset Details' }}
      />
      <Stack.Screen
        name="[assetId]/edit"
        options={{ title: 'Edit Asset' }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Asset' }}
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
