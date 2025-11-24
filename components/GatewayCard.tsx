import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Gateway } from '../types/database';

interface GatewayCardProps {
  gateway: Gateway;
  areaName?: string;
  status?: string;
  iotStatus?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

const getStatusColor = (status?: string, online?: boolean): string => {
  // If we have a status string, use the same logic as AssetCard
  if (status) {
    const lowerStatus = status.toLowerCase();
    
    // Specific status colors (checked first for priority)
    if (lowerStatus.includes('not installed') || lowerStatus.includes('not required')) {
      return '#9E9E9E'; // Gray
    }
    if (lowerStatus.includes('partially installed')) {
      return '#FF9800'; // Orange
    }
    if (lowerStatus.includes('installed') && lowerStatus.includes('communicating')) {
      return '#4CAF50'; // Green
    }
    if (lowerStatus.includes('installed') || lowerStatus.includes('communicating')) {
      return '#4CAF50'; // Green
    }
    
    // Fallback to general status patterns
    if (lowerStatus.includes('active') || lowerStatus.includes('online') || lowerStatus.includes('connected')) {
      return '#4CAF50'; // Green
    }
    if (lowerStatus.includes('warning') || lowerStatus.includes('pending')) {
      return '#FF9800'; // Orange
    }
    if (lowerStatus.includes('error') || lowerStatus.includes('offline') || lowerStatus.includes('disconnected') || lowerStatus.includes('alarm')) {
      return '#F44336'; // Red
    }
    if (lowerStatus.includes('inactive') || lowerStatus.includes('disabled')) {
      return '#9E9E9E'; // Gray
    }
    return '#2196F3'; // Blue (default)
  }
  
  // Fallback to online status if no status string
  if (online === true) {
    return '#4CAF50'; // Green
  }
  if (online === false) {
    return '#F44336'; // Red
  }
  return '#999'; // Gray (unknown)
};

export const GatewayCard: React.FC<GatewayCardProps> = React.memo(({ gateway, areaName, status, iotStatus, onPress, onLongPress }) => {
  // Use IoT status if available, otherwise fall back to regular status or online status
  const primaryStatus = iotStatus || status || (gateway.online ? 'Online' : 'Offline');
  const primaryStatusColor = getStatusColor(iotStatus || status, gateway.online);
  const displayStatus = status || (gateway.online ? 'Online' : 'Offline');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusIcon, { backgroundColor: primaryStatusColor }]} />
            <View style={styles.titleContainer}>
              <Text style={styles.name}>{gateway.code || 'No Code'}</Text>
              {gateway.internal_id ? (
                <Text style={styles.internalId}>{gateway.internal_id}</Text>
              ) : null}
            </View>
          </View>
          
          {gateway.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {gateway.description}
            </Text>
          ) : null}
          
          <View style={styles.footer}>
            {gateway.connection_type ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{gateway.connection_type}</Text>
              </View>
            ) : null}
            {gateway.serial_no ? (
              <Text style={styles.serialNo}>SN: {gateway.serial_no}</Text>
            ) : null}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {areaName ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Area</Text>
              <Text style={styles.metaValue}>{areaName}</Text>
            </View>
          ) : null}
          {iotStatus ? (
            <View style={styles.metaItem}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: primaryStatusColor }]} />
                <Text style={[styles.metaValue, { color: primaryStatusColor, fontWeight: '700' }]}>{iotStatus}</Text>
              </View>
            </View>
          ) : displayStatus ? (
            <View style={styles.metaItem}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: primaryStatusColor }]} />
                <Text style={[styles.metaValue, { color: primaryStatusColor }]}>{displayStatus}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 12,
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
  content: {
    flexDirection: 'row',
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  internalId: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 1,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  serialNo: {
    fontSize: 11,
    color: '#999',
  },
  metaItem: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});

