import { Stack } from 'expo-router';

export default function MachinesLayout() {
  return (
    <Stack>
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

