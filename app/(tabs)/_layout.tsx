import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : 56;
  const totalTabBarHeight = tabBarHeight + insets.bottom;
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        sceneContainerStyle: {
          paddingBottom: Platform.OS === 'web' ? 64 : totalTabBarHeight,
        },
        tabBarStyle: Platform.OS === 'web' ? {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        } : {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom,
          height: totalTabBarHeight,
        },
      }}
      initialRouteName="dashboard"
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: () => <Text>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: 'Machines',
          tabBarIcon: () => <Text>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="gateways"
        options={{
          title: 'Gateways',
          tabBarIcon: () => <Text>📡</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Text>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
