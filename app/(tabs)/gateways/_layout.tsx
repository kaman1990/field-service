import { Stack } from 'expo-router';

export default function GatewaysLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Gateways' }}
      />
      <Stack.Screen
        name="[gatewayId]"
        options={{ title: 'Gateway Details' }}
      />
      <Stack.Screen
        name="[gatewayId]/edit"
        options={{ title: 'Edit Gateway' }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Gateway' }}
      />
    </Stack>
  );
}
