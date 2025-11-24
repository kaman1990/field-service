import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { Ionicons } from '@expo/vector-icons';
import { ImageGallery } from '../../../components/ImageGallery';
import { CameraScreen } from '../../../components/CameraScreen';
import { AssetCard } from '../../../components/AssetCard';
import { gatewayService } from '../../../services/gateways';
import { assetService } from '../../../services/assets';
import { imageService } from '../../../services/images';
import { isNetworkError } from '../../../lib/error-utils';
import { lookupService } from '../../../services/lookups';
import type { Gateway, Image as ImageType, Asset, Area, GatewayStatus, GatewayIotStatus, AssetIotStatus } from '../../../types/database';
import { buildImagesQuery } from '../../../lib/powersync-queries';

export default function GatewayDetailScreen() {
  const { gatewayId } = useLocalSearchParams<{ gatewayId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [contextMenuAssetId, setContextMenuAssetId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ assetId: string; statusId: string | null; reason: string } | null>(null);

  const { data: gateway, isLoading: gatewayLoading } = useReactQuery<Gateway | null>({
    queryKey: ['gateway', gatewayId],
    queryFn: () => gatewayService.getGatewayById(gatewayId!),
  });

  const { data: allAreas = [] } = useReactQuery<Area[]>({
    queryKey: ['allAreas'],
    queryFn: () => lookupService.getAreas(),
  });

  const { data: statuses = [] } = useReactQuery<GatewayStatus[]>({
    queryKey: ['allGatewayStatuses'],
    queryFn: () => lookupService.getGatewayStatuses(),
  });

  const { data: gatewayIotStatuses = [] } = useReactQuery<GatewayIotStatus[]>({
    queryKey: ['gatewayIotStatuses'],
    queryFn: () => lookupService.getGatewayIotStatuses(),
  });

  const { data: assetIotStatuses = [] } = useReactQuery<AssetIotStatus[]>({
    queryKey: ['assetIotStatuses'],
    queryFn: () => lookupService.getAssetIotStatuses(),
  });

  const areaMap = useMemo(() => {
    return new Map(allAreas.map(a => [a.id, a.name]));
  }, [allAreas]);

  const statusMap = useMemo(() => {
    return new Map(statuses.map(s => [s.id, s.status || 'Unknown']));
  }, [statuses]);

  const gatewayIotStatusMap = useMemo(() => {
    return new Map(gatewayIotStatuses.map(s => [s.id, s.status || 'Unknown']));
  }, [gatewayIotStatuses]);

  const assetStatusMap = useMemo(() => {
    return new Map(assetIotStatuses.map(s => [s.id, s.status || 'Unknown']));
  }, [assetIotStatuses]);

  // Find asset IoT status IDs by status name
  const notRequiredStatusId = useMemo(() => {
    const status = assetIotStatuses.find(s => s.status?.toLowerCase().includes('not required'));
    return status?.id || null;
  }, [assetIotStatuses]);

  const notInstalledStatusId = useMemo(() => {
    const status = assetIotStatuses.find(s => s.status?.toLowerCase().includes('not installed'));
    return status?.id || null;
  }, [assetIotStatuses]);

  const { sql: gatewayImagesSql, params: gatewayImagesParams } = useMemo(
    () => buildImagesQuery('gateway', gatewayId!),
    [gatewayId]
  );
  const { data: images = [] } = useQuery<ImageType>(gatewayImagesSql, gatewayImagesParams);

  const { data: assets = [] } = useReactQuery<Asset[]>({
    queryKey: ['gatewayAssets', gatewayId],
    queryFn: () => assetService.getAssets({ gatewayId: gatewayId! }),
    enabled: !!gatewayId,
  });

  if (gatewayLoading || !gateway) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const areaName = gateway.area_id ? areaMap.get(gateway.area_id) : undefined;
  const status = gateway.status_id ? statusMap.get(gateway.status_id) : undefined;
  const iotStatus = gateway.iot_status_id ? gatewayIotStatusMap.get(gateway.iot_status_id) : undefined;
  const statusColor = getStatusColor(status, gateway.online);
  const iotStatusColor = getStatusColor(iotStatus, gateway.online);
  const displayStatus = status || (gateway.online ? 'Online' : 'Offline');

  const handleAddNote = () => {
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (asset) {
      setEditingAssetId(contextMenuAssetId);
      setNoteInput(asset.notes || '');
      setNoteModalVisible(true);
      setContextMenuAssetId(null);
    }
  };

  const handleSaveNote = async () => {
    if (!editingAssetId) return;
    try {
      const updateData: { notes: string; iot_status_id?: string | null } = { notes: noteInput };
      
      // If there's a pending status update, include it
      if (pendingStatusUpdate && pendingStatusUpdate.assetId === editingAssetId) {
        updateData.iot_status_id = pendingStatusUpdate.statusId as any;
      }
      
      await assetService.updateAsset(editingAssetId, updateData);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['gatewayAssets', gatewayId] });
      setNoteModalVisible(false);
      setNoteInput('');
      setEditingAssetId(null);
      setPendingStatusUpdate(null);
    } catch (error) {
      // Error updating note
      Alert.alert('Error', 'Failed to update note. Please try again.');
    }
  };

  const handleSetNotRequired = async () => {
    if (!contextMenuAssetId) return;
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (!asset) return;
    
    const isCurrentlyNotRequired = asset.iot_status_id === notRequiredStatusId;
    
    if (!notRequiredStatusId && !isCurrentlyNotRequired) {
      Alert.alert('Error', 'Could not find "Not Required" status.');
      setContextMenuAssetId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotRequired) {
      try {
        await assetService.updateAsset(contextMenuAssetId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        queryClient.invalidateQueries({ queryKey: ['gatewayAssets', gatewayId] });
        setContextMenuAssetId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuAssetId(null);
    setEditingAssetId(contextMenuAssetId);
    setPendingStatusUpdate({ assetId: contextMenuAssetId, statusId: notRequiredStatusId!, reason: 'Not Required' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleSetNotInstalled = async () => {
    if (!contextMenuAssetId) return;
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (!asset) return;
    
    const isCurrentlyNotInstalled = asset.iot_status_id === notInstalledStatusId;
    
    if (!notInstalledStatusId && !isCurrentlyNotInstalled) {
      Alert.alert('Error', 'Could not find "Not Installed" status.');
      setContextMenuAssetId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotInstalled) {
      try {
        await assetService.updateAsset(contextMenuAssetId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        queryClient.invalidateQueries({ queryKey: ['gatewayAssets', gatewayId] });
        setContextMenuAssetId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuAssetId(null);
    setEditingAssetId(contextMenuAssetId);
    setPendingStatusUpdate({ assetId: contextMenuAssetId, statusId: notInstalledStatusId!, reason: 'Not Installed' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleAddImage = () => {
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (asset) {
      setContextMenuAssetId(null);
      router.push(`/machines/${contextMenuAssetId}?fromGatewayId=${gatewayId}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{gateway.code || 'No Code'}</Text>
        {gateway.internal_id && (
          <Text style={styles.internalId}>{gateway.internal_id}</Text>
        )}
      </View>

      {gateway.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionContent}>{gateway.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {areaName ? <InfoRow label="Area" value={areaName} /> : null}
        {iotStatus ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>IoT Status:</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: iotStatusColor }]} />
              <Text style={[styles.infoValue, { color: iotStatusColor, fontWeight: '700' }]}>{iotStatus}</Text>
            </View>
          </View>
        ) : null}
        {displayStatus ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.infoValue, { color: statusColor }]}>{displayStatus}</Text>
            </View>
          </View>
        ) : null}
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
          {(gateway.power_required === true || gateway.power_required === 1) && <RequirementBadge label="Power Required" />}
          {(gateway.poe_required === true || gateway.poe_required === 1) && <RequirementBadge label="PoE Required" />}
          {(gateway.router_required === true || gateway.router_required === 1) && <RequirementBadge label="Router Required" />}
          {(gateway.flex_required === true || gateway.flex_required === 1) && <RequirementBadge label="Flex Required" />}
          {(gateway.atex_area === true || gateway.atex_area === 1) && <RequirementBadge label="ATEX Area" />}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Install Approved:</Text>
          <Text style={[styles.infoValue, (gateway.install_approved === true || gateway.install_approved === 1) ? styles.approved : styles.notApproved]}>
            {(gateway.install_approved === true || gateway.install_approved === 1) ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

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

      {assets.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Associated Machines ({assets.length})</Text>
            <TouchableOpacity
              onPress={() => router.push(`/machines?gatewayId=${gatewayId}`)}
            >
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>
          {assets.slice(0, 6).map((asset) => {
            const areaName = asset.area_id ? areaMap.get(asset.area_id) : undefined;
            const iotStatus = asset.iot_status_id ? assetStatusMap.get(asset.iot_status_id) : undefined;
            const gatewayName = gateway.code || undefined;
            
            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                areaName={areaName}
                iotStatus={iotStatus}
                gatewayName={gatewayName}
                onPress={() => router.push(`/machines/${asset.id}?fromGatewayId=${gatewayId}`)}
                onLongPress={() => setContextMenuAssetId(asset.id)}
              />
            );
          })}
          {assets.length > 6 && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => router.push(`/machines?gatewayId=${gatewayId}`)}
            >
              <Text style={styles.moreButtonText}>+{assets.length - 6} more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/gateways/${gatewayId}/edit`)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
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
                await imageService.uploadImage(uris[i], 'gateway', gatewayId!, gateway.site_id);
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

      {/* Context Menu Modal */}
      <Modal
        visible={!!contextMenuAssetId}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenuAssetId(null)}
      >
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuAssetId(null)}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            {(() => {
              const currentAsset = assets.find(a => a.id === contextMenuAssetId);
              const isNotRequired = currentAsset?.iot_status_id === notRequiredStatusId;
              const isNotInstalled = currentAsset?.iot_status_id === notInstalledStatusId;
              
              return (
                <>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      setContextMenuAssetId(null);
                      router.push(`/machines/${contextMenuAssetId}/edit?fromGatewayId=${gatewayId}`);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Edit Machine</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleAddNote}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Add Note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleAddImage}
                  >
                    <Ionicons name="camera-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Add Image</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.contextMenuDivider} />
                  
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleSetNotRequired}
                  >
                    <Ionicons 
                      name={isNotRequired ? "checkmark-circle" : "close-circle-outline"} 
                      size={20} 
                      color={isNotRequired ? "#4CAF50" : "#333"} 
                    />
                    <Text style={[styles.contextMenuText, isNotRequired && styles.contextMenuTextActive]}>
                      Set to Not Required
                    </Text>
                    {isNotRequired && (
                      <Ionicons name="checkmark" size={18} color="#4CAF50" style={styles.contextMenuCheckmark} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleSetNotInstalled}
                  >
                    <Ionicons 
                      name={isNotInstalled ? "checkmark-circle" : "remove-circle-outline"} 
                      size={20} 
                      color={isNotInstalled ? "#4CAF50" : "#333"} 
                    />
                    <Text style={[styles.contextMenuText, isNotInstalled && styles.contextMenuTextActive]}>
                      Set to Not Installed
                    </Text>
                    {isNotInstalled && (
                      <Ionicons name="checkmark" size={18} color="#4CAF50" style={styles.contextMenuCheckmark} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.contextMenuItem, styles.contextMenuCancel]}
                    onPress={() => setContextMenuAssetId(null)}
                  >
                    <Text style={styles.contextMenuCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Note Input Modal */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.inputModalOverlay}>
          <View style={styles.inputModalContent}>
            <Text style={styles.inputModalTitle}>
              {pendingStatusUpdate ? `Add Note - ${pendingStatusUpdate.reason}` : 'Add Note'}
            </Text>
            <TextInput
              style={styles.inputModalInput}
              multiline
              numberOfLines={4}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder="Enter note..."
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.inputModalActions}>
              <TouchableOpacity
                style={[styles.inputModalButton, styles.inputModalButtonCancel]}
                onPress={() => {
                  setNoteModalVisible(false);
                  setNoteInput('');
                  setEditingAssetId(null);
                  setPendingStatusUpdate(null);
                }}
              >
                <Text style={styles.inputModalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inputModalButton, styles.inputModalButtonSave]}
                onPress={handleSaveNote}
              >
                <Text style={styles.inputModalButtonSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
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
  approved: {
    color: '#4caf50',
  },
  notApproved: {
    color: '#f44336',
  },
  moreButton: {
    padding: 8,
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 14,
    color: '#007AFF',
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
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  contextMenuText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  contextMenuTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  contextMenuCheckmark: {
    marginLeft: 'auto',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  contextMenuCancel: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 4,
  },
  contextMenuCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  inputModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inputModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  inputModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputModalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  inputModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  inputModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  inputModalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  inputModalButtonSave: {
    backgroundColor: '#007AFF',
  },
  inputModalButtonCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  inputModalButtonSaveText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

