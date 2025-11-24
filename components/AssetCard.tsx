import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';
import type { Asset } from '../types/database';

interface AssetCardProps {
  asset: Asset;
  areaName?: string;
  iotStatus?: string;
  gatewayName?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

const getStatusColor = (status?: string): string => {
  if (!status) return '#999';
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
};

export const AssetCard: React.FC<AssetCardProps> = React.memo(({ asset, areaName, iotStatus, gatewayName, onPress, onLongPress }) => {
  const { colors } = useTheme();
  const statusColor = getStatusColor(iotStatus);

  const dynamicStyles = StyleSheet.create({
    card: {
      backgroundColor: colors.cardBackground,
      padding: 12,
      marginVertical: 6,
      marginHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    internalId: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 1,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      lineHeight: 18,
    },
    badge: {
      backgroundColor: colors.isDark ? '#1a3a5c' : '#e3f2fd',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: 6,
    },
    badgeText: {
      fontSize: 11,
      color: colors.isDark ? '#64b5f6' : '#1976d2',
      fontWeight: '500',
    },
    badgeTextUnmapped: {
      color: colors.textSecondary,
    },
    serialNo: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    metaLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 2,
      fontWeight: '500',
    },
    metaValue: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
      textAlign: 'right',
    },
  });

  return (
    <TouchableOpacity style={dynamicStyles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusIcon, { backgroundColor: statusColor }]} />
            <View style={styles.titleContainer}>
              <Text style={dynamicStyles.name}>{asset.name}</Text>
              {asset.internal_id ? (
                <Text style={dynamicStyles.internalId}>{asset.internal_id}</Text>
              ) : null}
            </View>
          </View>
          
          {asset.description ? (
            <Text style={dynamicStyles.description} numberOfLines={2}>
              {asset.description}
            </Text>
          ) : null}
          
          <View style={styles.footer}>
            {gatewayName ? (
              <View style={dynamicStyles.badge}>
                <Text style={dynamicStyles.badgeText}>Gateway: {gatewayName}</Text>
              </View>
            ) : (
              <View style={dynamicStyles.badge}>
                <Text style={[dynamicStyles.badgeText, dynamicStyles.badgeTextUnmapped]}>Gateway: Not Mapped</Text>
              </View>
            )}
            {asset.serial_no ? (
              <Text style={dynamicStyles.serialNo}>SN: {asset.serial_no}</Text>
            ) : null}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {areaName ? (
            <View style={styles.metaItem}>
              <Text style={dynamicStyles.metaLabel}>Area</Text>
              <Text style={dynamicStyles.metaValue}>{areaName}</Text>
            </View>
          ) : null}
          {iotStatus ? (
            <View style={styles.metaItem}>
              
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[dynamicStyles.metaValue, { color: statusColor }]}>{iotStatus}</Text>
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
  badgeTextUnmapped: {
    color: '#999',
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

