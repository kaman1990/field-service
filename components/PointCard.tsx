import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Point } from '../types/database';

interface PointCardProps {
  point: Point;
  onPress: () => void;
}

export const PointCard: React.FC<PointCardProps> = React.memo(({ point, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{point.name}</Text>
        {point.serial_no ? (
          <Text style={styles.serialNo}>SN: {point.serial_no}</Text>
        ) : null}
      </View>
      {point.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {point.description}
        </Text>
      ) : null}
      <View style={styles.footer}>
        {point.position ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{point.position}</Text>
          </View>
        ) : null}
        {point.asset_part ? (
          <Text style={styles.assetPart}>{point.asset_part}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

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
  serialNo: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '500',
  },
  assetPart: {
    fontSize: 12,
    color: '#999',
  },
});

