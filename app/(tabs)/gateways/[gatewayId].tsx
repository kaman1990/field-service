import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { ImageGallery } from '../../../components/ImageGallery';
import { CameraScreen } from '../../../components/CameraScreen';
import { gatewayService } from '../../../services/gateways';
import { imageService } from '../../../services/images';
import { isNetworkError } from '../../../lib/error-utils';
import type { Gateway, Image as ImageType, Point } from '../../../types/database';
import { buildImagesQuery } from '../../../lib/powersync-queries';

export default function GatewayDetailScreen() {
  const { gatewayId } = useLocalSearchParams<{ gatewayId: string }>();
  const router = useRouter();
  const [cameraVisible, setCameraVisible] = useState(false);

  const { data: gateway, isLoading: gatewayLoading } = useReactQuery<Gateway | null>({
    queryKey: ['gateway', gatewayId],
    queryFn: () => gatewayService.getGatewayById(gatewayId!),
  });

  const { sql: gatewayImagesSql, params: gatewayImagesParams } = useMemo(
    () => buildImagesQuery('gateway', gatewayId!),
    [gatewayId]
  );
  const { data: images = [] } = useQuery<ImageType>(gatewayImagesSql, gatewayImagesParams);

  const { data: points = [] } = useReactQuery<Point[]>({
    queryKey: ['gatewayPoints', gatewayId],
    queryFn: () => gatewayService.getGatewayPoints(gatewayId!),
    enabled: !!gatewayId,
  });

  if (gatewayLoading || !gateway) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{gateway.code || 'No Code'}</Text>
          <View style={[styles.statusIndicator, gateway.online ? styles.online : styles.offline]} />
        </View>
        {gateway.description && (
          <Text style={styles.description}>{gateway.description}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {gateway.serial_no ? <InfoRow label="Serial No" value={gateway.serial_no.toString()} /> : null}
        {gateway.mac_address ? <InfoRow label="MAC Address" value={gateway.mac_address} /> : null}
        {gateway.ip_address ? <InfoRow label="IP Address" value={gateway.ip_address} /> : null}
        {gateway.router ? <InfoRow label="Router" value={gateway.router} /> : null}
        {gateway.version ? <InfoRow label="Version" value={gateway.version} /> : null}
        {gateway.location ? <InfoRow label="Location" value={gateway.location} /> : null}
        {gateway.connection_type ? <InfoRow label="Connection Type" value={gateway.connection_type} /> : null}
        {gateway.mount_type ? <InfoRow label="Mount Type" value={gateway.mount_type} /> : null}
        {gateway.power_type ? <InfoRow label="Power Type" value={gateway.power_type} /> : null}
        {gateway.notes ? <InfoRow label="Notes" value={gateway.notes} /> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Installation Requirements</Text>
        <View style={styles.requirements}>
          {gateway.power_required && <RequirementBadge label="Power Required" />}
          {gateway.poe_required && <RequirementBadge label="PoE Required" />}
          {gateway.router_required && <RequirementBadge label="Router Required" />}
          {gateway.flex_required && <RequirementBadge label="Flex Required" />}
          {gateway.atex_area && <RequirementBadge label="ATEX Area" />}
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Install Approved:</Text>
          <Text style={[styles.statusValue, gateway.install_approved ? styles.approved : styles.notApproved]}>
            {gateway.install_approved ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {points.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Associated Points ({points.length})</Text>
          {points.slice(0, 5).map((point) => (
            <View key={point.id} style={styles.pointItem}>
              <Text style={styles.pointName}>{point.name}</Text>
              {point.serial_no && <Text style={styles.pointSerial}>SN: {point.serial_no}</Text>}
            </View>
          ))}
          {points.length > 5 && (
            <Text style={styles.moreText}>+{points.length - 5} more points</Text>
          )}
        </View>
      )}

      {images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Images</Text>
          <ImageGallery images={images} />
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/gateways/${gatewayId}/edit`)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <View style={styles.photoButtons}>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => setCameraVisible(true)}
          >
            <Text style={styles.cameraButtonText}>📷 Add Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={async () => {
              try {
                const result = await imageService.pickImage();
                if (!result.canceled && result.assets?.[0]) {
                  await imageService.uploadImage(result.assets[0].uri, 'gateway', gatewayId!, gateway.site_id);
                }
              } catch (error) {
                console.error('Error picking image:', error);
              }
            }}
          >
            <Text style={styles.galleryButtonText}>🖼️</Text>
          </TouchableOpacity>
        </View>
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
                await imageService.uploadImage(uris[i], 'gateway', gatewayId!, gateway.site_id);
                // Add a small delay between each image to let PowerSync process them
                if (i < uris.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                }
              }
              setCameraVisible(false);
            } catch (error) {
              console.error('Error uploading images:', error);
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

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value != null ? String(value) : ''}</Text>
  </View>
);

const RequirementBadge = ({ label }: { label: string }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 140,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  requirements: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  approved: {
    color: '#4caf50',
  },
  notApproved: {
    color: '#f44336',
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
  moreText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
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
  photoButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  cameraButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cameraButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
});

