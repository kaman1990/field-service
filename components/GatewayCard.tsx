import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Gateway } from '../types/database';

interface GatewayCardProps {
  gateway: Gateway;
  onPress: () => void;
  onLongPress?: () => void;
}

export const GatewayCard: React.FC<GatewayCardProps> = ({ gateway, onPress, onLongPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{gateway.code || 'No Code'}</Text>
        <View style={[styles.statusIndicator, gateway.online ? styles.online : styles.offline]} />
      </View>
      {gateway.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {gateway.description}
        </Text>
      ) : null}
      <View style={styles.footer}>
        {gateway.serial_no ? (
          <Text style={styles.serialNo}>SN: {gateway.serial_no}</Text>
        ) : null}
        {gateway.connection_type ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{gateway.connection_type}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  online: {
    backgroundColor: '#4caf50',
  },
  offline: {
    backgroundColor: '#f44336',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '500',
  },
  serialNo: {
    fontSize: 12,
    color: '#999',
  },
});

