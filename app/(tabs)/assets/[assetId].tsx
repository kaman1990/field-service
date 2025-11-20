import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { Ionicons } from '@expo/vector-icons';
import { ImageGallery } from '../../../components/ImageGallery';
import { CameraScreen } from '../../../components/CameraScreen';
import { BarcodeScanner } from '../../../components/BarcodeScanner';
import { OptionButtons } from '../../../components/OptionButtons';
import { OrientationVisualizer } from '../../../components/OrientationVisualizer';
import { imageService } from '../../../services/images';
import { isNetworkError } from '../../../lib/error-utils';
import { pointService } from '../../../services/points';
import { buildImagesQuery, buildPointsQuery, getTableName } from '../../../lib/powersync-queries';
import { lookupService } from '../../../services/lookups';
import type { Asset, Image as ImageType, Point, PointIotStatus } from '../../../types/database';

export default function AssetDetailScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [pointCameraVisible, setPointCameraVisible] = useState<string | null>(null);
  const [pointScannerVisible, setPointScannerVisible] = useState<string | null>(null);
  const [contextMenuPointId, setContextMenuPointId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [orientationModalVisible, setOrientationModalVisible] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [orientationInput, setOrientationInput] = useState('');
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ pointId: string; statusId: string | null; reason: string } | null>(null);

  const assetsTable = getTableName('assets');
  const { data: assetResults = [] } = useQuery<Asset>(
    `SELECT * FROM ${assetsTable} WHERE id = ?`,
    [assetId]
  );
  const asset = assetResults?.[0] || null;
  const assetLoading = !asset && assetResults.length === 0;

  const { sql: assetImagesSql, params: assetImagesParams } = useMemo(
    () => buildImagesQuery('asset', assetId!),
    [assetId]
  );
  const { data: images = [] } = useQuery<ImageType>(assetImagesSql, assetImagesParams);

  const { data: iotStatuses = [] } = useReactQuery<PointIotStatus[]>({
    queryKey: ['pointIotStatuses'],
    queryFn: () => lookupService.getPointIotStatuses(),
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, string>();
    iotStatuses.forEach((status) => {
      if (status.id && status.status) {
        map.set(status.id, status.status);
      }
    });
    return map;
  }, [iotStatuses]);

  // Find IoT status IDs for "not required" and "not installed"
  const notRequiredStatusId = useMemo(() => {
    const status = iotStatuses.find(s => s.status?.toLowerCase().includes('not required'));
    return status?.id || null;
  }, [iotStatuses]);

  const notInstalledStatusId = useMemo(() => {
    const status = iotStatuses.find(s => s.status?.toLowerCase().includes('not installed'));
    return status?.id || null;
  }, [iotStatuses]);

  const { sql: pointsSql, params: pointsParams } = buildPointsQuery(assetId!);
  const { data: pointsData = [] } = useQuery<Point>(pointsSql, pointsParams);

  // Sort points in machine direction order: Motor NDE, Motor DE, GB DE, GB NDE, Equipment DE, Equipment NDE
  const points = useMemo(() => {
    const sorted = [...pointsData];
    
    const getAssetPartPriority = (assetPart: string | undefined): number => {
      if (!assetPart) return 999;
      const part = assetPart.toLowerCase();
      if (part.includes('motor')) return 1;
      if (part.includes('gearbox') || part.includes('gb')) return 2;
      if (part.includes('equipment')) return 3;
      return 999;
    };

    const getPositionPriority = (assetPart: string | undefined, position: string | undefined): number => {
      if (!position) return 999;
      const pos = position.toLowerCase();
      const part = assetPart?.toLowerCase() || '';
      
      // Motor: NDE before DE
      if (part.includes('motor')) {
        if (pos.includes('nde') || pos.includes('non-drive')) return 1;
        if (pos.includes('de') || pos.includes('drive')) return 2;
      }
      
      // Gearbox/GB: DE before NDE
      if (part.includes('gearbox') || part.includes('gb')) {
        if (pos.includes('de') || pos.includes('drive')) return 1;
        if (pos.includes('nde') || pos.includes('non-drive')) return 2;
      }
      
      // Equipment: DE before NDE
      if (part.includes('equipment')) {
        if (pos.includes('de') || pos.includes('drive')) return 1;
        if (pos.includes('nde') || pos.includes('non-drive')) return 2;
      }
      
      return 999;
    };

    sorted.sort((a, b) => {
      const aPartPriority = getAssetPartPriority(a.asset_part);
      const bPartPriority = getAssetPartPriority(b.asset_part);
      
      if (aPartPriority !== bPartPriority) {
        return aPartPriority - bPartPriority;
      }
      
      const aPosPriority = getPositionPriority(a.asset_part, a.position);
      const bPosPriority = getPositionPriority(b.asset_part, b.position);
      
      if (aPosPriority !== bPosPriority) {
        return aPosPriority - bPosPriority;
      }
      
      // Fallback to name if same priority
      return (a.name || '').localeCompare(b.name || '');
    });
    
    return sorted;
  }, [pointsData]);

  const handleLongPress = (pointId: string) => {
    setContextMenuPointId(pointId);
  };

  const handleAddNote = () => {
    const point = points.find(p => p.id === contextMenuPointId);
    if (point) {
      setEditingPointId(contextMenuPointId);
      setNoteInput(point.notes || '');
      setNoteModalVisible(true);
      setContextMenuPointId(null);
    }
  };

  const handleSaveNote = async () => {
    if (!editingPointId) return;
    try {
      const updateData: { notes: string; iot_status_id?: string | null } = { notes: noteInput };
      
      // If there's a pending status update, include it
      if (pendingStatusUpdate && pendingStatusUpdate.pointId === editingPointId) {
        updateData.iot_status_id = pendingStatusUpdate.statusId as any;
      }
      
      await pointService.updatePoint(editingPointId, updateData);
      queryClient.invalidateQueries({ queryKey: ['points'] });
      setNoteModalVisible(false);
      setNoteInput('');
      setEditingPointId(null);
      setPendingStatusUpdate(null);
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'Failed to update note. Please try again.');
    }
  };

  const handleSetNotRequired = async () => {
    if (!contextMenuPointId) return;
    const point = points.find(p => p.id === contextMenuPointId);
    if (!point) return;
    
    // Toggle: if already set to not required, unset it; otherwise set it
    const isCurrentlyNotRequired = point.iot_status_id === notRequiredStatusId;
    
    if (!notRequiredStatusId && !isCurrentlyNotRequired) {
      Alert.alert('Error', 'Could not find "Not Required" status.');
      setContextMenuPointId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotRequired) {
      try {
        await pointService.updatePoint(contextMenuPointId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['points'] });
        setContextMenuPointId(null);
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuPointId(null);
    setEditingPointId(contextMenuPointId);
    setPendingStatusUpdate({ pointId: contextMenuPointId, statusId: notRequiredStatusId!, reason: 'Not Required' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleSetNotInstalled = async () => {
    if (!contextMenuPointId) return;
    const point = points.find(p => p.id === contextMenuPointId);
    if (!point) return;
    
    // Toggle: if already set to not installed, unset it; otherwise set it
    const isCurrentlyNotInstalled = point.iot_status_id === notInstalledStatusId;
    
    if (!notInstalledStatusId && !isCurrentlyNotInstalled) {
      Alert.alert('Error', 'Could not find "Not Installed" status.');
      setContextMenuPointId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotInstalled) {
      try {
        await pointService.updatePoint(contextMenuPointId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['points'] });
        setContextMenuPointId(null);
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuPointId(null);
    setEditingPointId(contextMenuPointId);
    setPendingStatusUpdate({ pointId: contextMenuPointId, statusId: notInstalledStatusId!, reason: 'Not Installed' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleChangeOrientation = () => {
    const point = points.find(p => p.id === contextMenuPointId);
    if (point) {
      setEditingPointId(contextMenuPointId);
      setOrientationInput(point.sensor_orientation || '');
      setOrientationModalVisible(true);
      setContextMenuPointId(null);
    }
  };

  const handleSaveOrientation = async (value: string | null) => {
    if (!editingPointId) return;
    try {
      await pointService.updatePoint(editingPointId, { sensor_orientation: value || undefined });
      queryClient.invalidateQueries({ queryKey: ['points'] });
      setOrientationModalVisible(false);
      setOrientationInput('');
      setEditingPointId(null);
    } catch (error) {
      console.error('Error updating orientation:', error);
      Alert.alert('Error', 'Failed to update orientation. Please try again.');
    }
  };

  const { data: additionalDetails = [] } = useQuery(
    'SELECT * FROM asset_additional_details WHERE asset_id = ? AND enabled = ? ORDER BY field',
    [assetId, true]
  );

  const { data: history = [] } = useQuery(
    'SELECT * FROM asset_history WHERE asset_id = ? AND enabled = ? ORDER BY created_at DESC',
    [assetId, true]
  );

  if (assetLoading || !asset) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{asset.name}</Text>
        {asset.internal_id && (
          <Text style={styles.internalId}>{asset.internal_id}</Text>
        )}
      </View>

      {asset.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionContent}>{asset.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {asset.type ? <InfoRow label="Type" value={asset.type} /> : null}
        {asset.manufacturer ? <InfoRow label="Manufacturer" value={asset.manufacturer} /> : null}
        {asset.model ? <InfoRow label="Model" value={asset.model} /> : null}
        {asset.serial_no ? <InfoRow label="Serial No" value={asset.serial_no} /> : null}
        {asset.notes ? <InfoRow label="Notes" value={asset.notes} /> : null}
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Points ({points.length})</Text>
          <TouchableOpacity
            onPress={() => router.push(`/assets/points?assetId=${assetId}`)}
          >
            <Text style={styles.linkText}>View All</Text>
          </TouchableOpacity>
        </View>
        {points.length > 0 ? (
          <View>
            {points.slice(0, 6).map((point) => {
              const displayName = [point.asset_part, point.position].filter(Boolean).join(' ') || point.name;
              const status = point.iot_status_id ? statusMap.get(point.iot_status_id) : undefined;
              const statusColors = getStatusColors(status);
              return (
                <View key={point.id} style={styles.pointItem}>
                  <TouchableOpacity
                    style={styles.pointContent}
                    onPress={() => router.push(`/assets/points/${point.id}?assetId=${assetId}`)}
                    onLongPress={() => handleLongPress(point.id)}
                  >
                    <View style={styles.pointHeader}>
                      <Text style={styles.pointName}>{displayName}</Text>
                      {status && (
                        <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor }]}>
                          <Text style={[styles.statusText, { color: statusColors.textColor }]}>{status}</Text>
                        </View>
                      )}
                    </View>
                    {point.full_serial_no && <Text style={styles.pointSerial}>SN: {point.full_serial_no}</Text>}
                  </TouchableOpacity>
                  <View style={styles.pointActions}>
                    <TouchableOpacity
                      style={styles.pointActionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setPointCameraVisible(point.id);
                      }}
                    >
                      <Ionicons name="camera" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pointActionButton, { marginLeft: 8 }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        setPointScannerVisible(point.id);
                      }}
                    >
                      <Ionicons name="qr-code" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {points.length > 6 && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => router.push(`/assets/points?assetId=${assetId}`)}
              >
                <Text style={styles.moreButtonText}>+{points.length - 6} more</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>No points</Text>
        )}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/assets/points/new?assetId=${assetId}`)}
        >
          <Text style={styles.addButtonText}>+ Add Point</Text>
        </TouchableOpacity>
      </View>

      {additionalDetails.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          {additionalDetails.map((detail: any) => (
            <InfoRow key={detail.id} label={detail.field} value={detail.value} />
          ))}
        </View>
      )}

      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {history.slice(0, 5).map((item: any) => (
            <View key={item.id} style={styles.historyItem}>
              <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              {item.description && <Text style={styles.historyText}>{item.description}</Text>}
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/assets/${assetId}/edit`)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={async () => {
            try {
              const result = await imageService.pickImage();
              if (!result.canceled && result.assets?.[0]) {
                await imageService.uploadImage(result.assets[0].uri, 'asset', assetId!, asset.site_id);
              }
            } catch (error) {
              console.error('Error picking image:', error);
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
                await imageService.uploadImage(uris[i], 'asset', assetId!, asset.site_id);
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

      {pointCameraVisible && (
        <Modal
          visible={!!pointCameraVisible}
          animationType="slide"
          onRequestClose={() => setPointCameraVisible(null)}
        >
          <CameraScreen
            onPhotosTaken={async (uris) => {
              try {
                const point = points.find(p => p.id === pointCameraVisible);
                if (point) {
                  // Stagger adding images to the queue to avoid race conditions
                  for (let i = 0; i < uris.length; i++) {
                    await imageService.uploadImage(uris[i], 'point', pointCameraVisible, point.site_id);
                    // Add a small delay between each image to let PowerSync process them
                    if (i < uris.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                    }
                  }
                }
                setPointCameraVisible(null);
              } catch (error) {
                console.error('Error uploading images:', error);
                Alert.alert('Error', 'Failed to upload some images. Please try again.');
              }
            }}
            onClose={() => setPointCameraVisible(null)}
          />
        </Modal>
      )}

      {pointScannerVisible && (
        <Modal
          visible={!!pointScannerVisible}
          animationType="slide"
          onRequestClose={() => setPointScannerVisible(null)}
        >
          <BarcodeScanner
            onBarcodeScanned={async (data) => {
              try {
                await pointService.updatePoint(pointScannerVisible!, { full_serial_no: data });
                // Invalidate queries to refresh the points list
                queryClient.invalidateQueries({ queryKey: ['points'] });
                // Close scanner and prompt for orientation
                setPointScannerVisible(null);
                setEditingPointId(pointScannerVisible);
                const point = points.find(p => p.id === pointScannerVisible);
                setOrientationInput(point?.sensor_orientation || '');
                setOrientationModalVisible(true);
              } catch (error) {
                console.error('Error updating point:', error);
                Alert.alert('Error', 'Failed to update serial number. Please try again.');
              }
            }}
            onClose={() => setPointScannerVisible(null)}
          />
        </Modal>
      )}

      {/* Context Menu Modal */}
      <Modal
        visible={!!contextMenuPointId}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenuPointId(null)}
      >
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuPointId(null)}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            {(() => {
              const currentPoint = points.find(p => p.id === contextMenuPointId);
              const isNotRequired = currentPoint?.iot_status_id === notRequiredStatusId;
              const isNotInstalled = currentPoint?.iot_status_id === notInstalledStatusId;
              
              return (
                <>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      setContextMenuPointId(null);
                      router.push(`/assets/points/${contextMenuPointId}/edit?assetId=${assetId}`);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Edit Point</Text>
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
                    onPress={handleChangeOrientation}
                  >
                    <Ionicons name="compass-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Change Orientation</Text>
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
                    onPress={() => setContextMenuPointId(null)}
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
                  setEditingPointId(null);
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

      {/* Orientation Input Modal */}
      <Modal
        visible={orientationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setOrientationModalVisible(false);
          setOrientationInput('');
          setEditingPointId(null);
        }}
      >
        <View style={styles.inputModalOverlay}>
          <View style={styles.inputModalContent}>
            <Text style={styles.inputModalTitle}>Change Orientation</Text>
            {orientationInput && (
              <View style={styles.inputModalPickerContainer}>
                <OrientationVisualizer orientation={orientationInput} />
              </View>
            )}
            <View style={styles.inputModalPickerContainer}>
              <OptionButtons
                value={orientationInput || null}
                options={[
                  { label: 'AVH', value: 'AVH' },
                  { label: 'AHV', value: 'AHV' },
                  { label: 'VAH', value: 'VAH' },
                  { label: 'VHA', value: 'VHA' },
                  { label: 'HAV', value: 'HAV' },
                  { label: 'HVA', value: 'HVA' },
                ]}
                onValueChange={(value) => {
                  setOrientationInput(value || '');
                  handleSaveOrientation(value);
                }}
              />
            </View>
            <View style={styles.inputModalActions}>
              <TouchableOpacity
                style={[styles.inputModalButton, styles.inputModalButtonCancel]}
                onPress={() => {
                  setOrientationModalVisible(false);
                  setOrientationInput('');
                  setEditingPointId(null);
                }}
              >
                <Text style={styles.inputModalButtonCancelText}>Cancel</Text>
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

const getStatusColors = (status?: string): { backgroundColor: string; textColor: string } => {
  if (!status) return { backgroundColor: '#e3f2fd', textColor: '#1976d2' };
  const lowerStatus = status.toLowerCase();
  
  // Specific status colors (checked first for priority)
  if (lowerStatus.includes('not installed') || lowerStatus.includes('not required')) {
    return { backgroundColor: '#f5f5f5', textColor: '#9E9E9E' }; // Gray
  }
  if (lowerStatus.includes('partially installed')) {
    return { backgroundColor: '#fff3e0', textColor: '#FF9800' }; // Orange
  }
  if (lowerStatus.includes('installed') && lowerStatus.includes('communicating')) {
    return { backgroundColor: '#e8f5e9', textColor: '#4CAF50' }; // Green
  }
  if (lowerStatus.includes('installed') || lowerStatus.includes('communicating')) {
    return { backgroundColor: '#e8f5e9', textColor: '#4CAF50' }; // Green
  }
  
  // Fallback to general status patterns
  if (lowerStatus.includes('active') || lowerStatus.includes('online') || lowerStatus.includes('connected')) {
    return { backgroundColor: '#e8f5e9', textColor: '#4CAF50' }; // Green
  }
  if (lowerStatus.includes('warning') || lowerStatus.includes('pending')) {
    return { backgroundColor: '#fff3e0', textColor: '#FF9800' }; // Orange
  }
  if (lowerStatus.includes('error') || lowerStatus.includes('offline') || lowerStatus.includes('disconnected') || lowerStatus.includes('alarm')) {
    return { backgroundColor: '#ffebee', textColor: '#F44336' }; // Red
  }
  if (lowerStatus.includes('inactive') || lowerStatus.includes('disabled')) {
    return { backgroundColor: '#f5f5f5', textColor: '#9E9E9E' }; // Gray
  }
  return { backgroundColor: '#e3f2fd', textColor: '#1976d2' }; // Blue (default)
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
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  pointContent: {
    flex: 1,
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  pointName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    flexShrink: 1,
  },
  pointActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  pointActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
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
  inputModalPickerContainer: {
    marginBottom: 20,
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
