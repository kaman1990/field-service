import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { Ionicons } from '@expo/vector-icons';
import { ImageGallery } from '../../../../components/ImageGallery';
import { CameraScreen } from '../../../../components/CameraScreen';
import { pointService } from '../../../../services/points';
import { imageService } from '../../../../services/images';
import { isNetworkError } from '../../../../lib/error-utils';
import { assetService } from '../../../../services/assets';
import type { Point, Image as ImageType, Asset } from '../../../../types/database';
import { buildImagesQuery } from '../../../../lib/powersync-queries';

export default function PointDetailScreen() {
  const { pointId, assetId } = useLocalSearchParams<{ pointId: string; assetId: string }>();
  const router = useRouter();
  const [cameraVisible, setCameraVisible] = useState(false);

  const { data: point, isLoading: pointLoading } = useReactQuery<Point | null>({
    queryKey: ['point', pointId],
    queryFn: () => pointService.getPointById(pointId!),
  });

  const { data: asset } = useReactQuery<Asset | null>({
    queryKey: ['asset', assetId],
    queryFn: () => assetService.getAssetById(assetId!),
    enabled: !!assetId,
  });

  const { sql: pointImagesSql, params: pointImagesParams } = useMemo(
    () => buildImagesQuery('point', pointId!),
    [pointId]
  );
  const { data: images = [] } = useQuery<ImageType>(pointImagesSql, pointImagesParams);

  if (pointLoading || !point) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{point.name}</Text>
        {asset && (
          <TouchableOpacity onPress={() => router.push(`/machines/${asset.id}`)}>
            <Text style={styles.assetLink}>Machine: {asset.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {point.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionContent}>{point.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {point.serial_no != null ? <InfoRow label="Serial No" value={point.serial_no.toString()} /> : null}
        {point.full_serial_no ? <InfoRow label="Full Serial No" value={point.full_serial_no} /> : null}
        {point.position ? <InfoRow label="Position" value={point.position} /> : null}
        {point.asset_part ? <InfoRow label="Asset Part" value={point.asset_part} /> : null}
        {point.bearing ? <InfoRow label="Bearing" value={point.bearing} /> : null}
        {point.sensor_orientation ? <InfoRow label="Sensor Orientation" value={point.sensor_orientation} /> : null}
        {point.notes ? <InfoRow label="Notes" value={point.notes} /> : null}
      </View>

      {(point.satisfactory != null || point.warning != null || point.alarm != null) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Measurement Thresholds</Text>
          {point.satisfactory != null ? <InfoRow label="Satisfactory" value={point.satisfactory.toString()} /> : null}
          {point.warning != null ? <InfoRow label="Warning" value={point.warning.toString()} /> : null}
          {point.alarm != null ? <InfoRow label="Alarm" value={point.alarm.toString()} /> : null}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.imagesSectionHeader}>
          <Text style={styles.sectionTitle}>Images</Text>
          <TouchableOpacity
            style={styles.cameraIconButton}
            onPress={() => setCameraVisible(true)}
          >
            <Ionicons name="camera" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {images.length > 0 ? (
          <ImageGallery images={images} />
        ) : (
          <Text style={styles.emptyText}>No images</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/machines/points/${pointId}/edit?assetId=${assetId}`)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={async () => {
            try {
              const result = await imageService.pickImage();
              if (!result.canceled && result.assets?.[0]) {
                await imageService.uploadImage(result.assets[0].uri, 'point', pointId!, point.site_id);
              }
            } catch (error) {
              // Error picking image
            }
          }}
        >
          <Text style={styles.galleryButtonText}>🖼️</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <CameraScreen
          onPhotosTaken={async (uris) => {
            try {
              // Stagger adding images to the queue to avoid race conditions
              for (let i = 0; i < uris.length; i++) {
                await imageService.uploadImage(uris[i], 'point', pointId!, point.site_id);
                // Add a small delay between each image to let PowerSync process them
                if (i < uris.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                }
              }
              setCameraVisible(false);
            } catch (error) {
              // Error uploading images
              // Only show error if it's not a network/offline error
              // Network errors are expected when offline - images are queued and will upload when back online
              if (!isNetworkError(error)) {
                Alert.alert('Error', 'Failed to upload some images. Please try again.');
              }
            }
          }}
          onClose={() => setCameraVisible(false)}
        />
      </Modal>
    </ScrollView>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value != null ? String(value) : ''}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  internalId: {
    fontSize: 16,
    color: '#666',
  },
  assetLink: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  imagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  pointItem: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  pointName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  pointSerial: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  moreButton: {
    padding: 8,
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  addButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  historyItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 12,
  },
  galleryButton: {
    width: 56,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButtonText: {
    fontSize: 20,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
