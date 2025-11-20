import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform, Text } from 'react-native';
import { useStatus } from '@powersync/react';
import { syncService } from '../services/sync';
import { AttachmentState } from '@powersync/attachments';

/**
 * Simple colored icon indicator for PowerSync connection status
 * - Green: Connected
 * - Flashing Green: Syncing (uploading/downloading)
 * - Red: Disconnected
 */
export const PowerSyncStatus: React.FC = () => {
  const status = useStatus();
  const flashAnim = useRef(new Animated.Value(1)).current;
  const [pendingUploads, setPendingUploads] = useState(0);

  // Load pending uploads count
  useEffect(() => {
    const loadPendingUploads = async () => {
      try {
        const syncStatus = await syncService.getSyncStatus();
        setPendingUploads(syncStatus.pendingUploads);
      } catch (error) {
        // Silent fail
      }
    };

    loadPendingUploads();
    const interval = setInterval(loadPendingUploads, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Flash animation when syncing
    if (status?.uploading || status?.downloading || pendingUploads > 0) {
      const flash = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      flash.start();
      return () => flash.stop();
    } else {
      // Reset to solid when not syncing
      flashAnim.setValue(1);
    }
  }, [status?.uploading, status?.downloading, pendingUploads, flashAnim]);

  const getStatusColor = () => {
    if (status?.connected) {
      return '#4CAF50'; // Green
    }
    return '#F44336'; // Red
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: getStatusColor(),
            opacity: flashAnim,
          },
        ]}
      />
      {pendingUploads > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingUploads}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 50,
    right: 10,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: 12,
    height: 12,
    borderRadius: 6,
    ...Platform.select({
      web: {
        // @ts-ignore - boxShadow is for web compatibility
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      },
    }),
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff9500',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

