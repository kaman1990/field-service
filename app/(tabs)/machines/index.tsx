import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery as useReactQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { Ionicons } from '@expo/vector-icons';
import { AssetCard } from '../../../components/AssetCard';
import { SearchBar } from '../../../components/SearchBar';
import { FilterPanel } from '../../../components/FilterPanel';
import { SimplePicker } from '../../../components/SimplePicker';
import { CameraScreen } from '../../../components/CameraScreen';
import { lookupService } from '../../../services/lookups';
import { assetService } from '../../../services/assets';
import { imageService } from '../../../services/images';
import { retoolUserService } from '../../../services/retoolUser';
import { buildAssetsQuery } from '../../../lib/powersync-queries';
import { getPowerSync } from '../../../lib/powersync';
import { isNetworkError } from '../../../lib/error-utils';
import type { Asset, Area, AssetIotStatus, Gateway } from '../../../types/database';

export default function AssetListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const fabBottom = 20 + tabBarHeight + (Platform.OS !== 'web' ? insets.bottom : 0);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [selectedIotStatusId, setSelectedIotStatusId] = useState<string | undefined>();
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | undefined>();
  const [contextMenuAssetId, setContextMenuAssetId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ assetId: string; statusId: string | null; reason: string } | null>(null);
  const [assignGatewayModalVisible, setAssignGatewayModalVisible] = useState(false);
  const [assigningAssetId, setAssigningAssetId] = useState<string | null>(null);
  const [selectedGatewayForAssign, setSelectedGatewayForAssign] = useState<string | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraAssetId, setCameraAssetId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Watch for changes to lookup tables and invalidate React Query cache
  useEffect(() => {
    try {
      const powerSync = getPowerSync();
      if (!powerSync) return;

      // Watch for changes to lookup tables
      const dispose = powerSync.onChange({
        onChange: async (event: { changedTables?: string[] }) => {
          const changedTables = event.changedTables || [];
          
          // If any lookup tables changed, invalidate the React Query cache
          // Handle different table name formats (e.g., 'areas', 'public_areas', 'public.areas')
          const lookupTablePatterns = ['areas', 'asset_iot_status', 'gateways'];
          const hasLookupTableChange = changedTables.some((table: string) => 
            lookupTablePatterns.some(pattern => 
              table === pattern || 
              table.includes(pattern) ||
              table.endsWith(`_${pattern}`) ||
              table.endsWith(`.${pattern}`)
            )
          );
          
          if (hasLookupTableChange) {
            queryClient.invalidateQueries({ queryKey: ['allAreas'] });
            queryClient.invalidateQueries({ queryKey: ['assetIotStatuses'] });
            queryClient.invalidateQueries({ queryKey: ['allGateways'] });
          }
        },
        onError: (error: any) => {
          // Error watching PowerSync changes
        }
      }, {
        tables: ['areas', 'asset_iot_status', 'gateways'],
        triggerImmediate: false
      });

      return () => {
        dispose();
      };
    } catch (error: any) {
      // Error setting up PowerSync watcher
    }
  }, [queryClient]);

  const { data: allAreas = [] } = useReactQuery<Area[]>({
    queryKey: ['allAreas'],
    queryFn: () => lookupService.getAreas(),
  });

  const { data: iotStatuses = [] } = useReactQuery<AssetIotStatus[]>({
    queryKey: ['assetIotStatuses'],
    queryFn: () => lookupService.getAssetIotStatuses(),
  });

  const { data: gateways = [] } = useReactQuery<Gateway[]>({
    queryKey: ['allGateways'],
    queryFn: () => lookupService.getGateways(),
  });

  // Get default site ID for current user
  const { data: defaultSiteId } = useReactQuery<string | null>({
    queryKey: ['defaultSiteId'],
    queryFn: () => retoolUserService.getDefaultSiteId(),
  });

  const { sql, params } = useMemo(() => buildAssetsQuery({
    search: debouncedSearchText || undefined,
    areaId: selectedAreaId,
    iotStatusId: selectedIotStatusId,
    gatewayId: selectedGatewayId,
    defaultSiteId: defaultSiteId,
  }), [debouncedSearchText, selectedAreaId, selectedIotStatusId, selectedGatewayId, defaultSiteId]);

  // Query for counting assets by IoT status (without IoT status filter, but respects other filters)
  const { sql: countSql, params: countParams } = useMemo(() => buildAssetsQuery({
    search: debouncedSearchText || undefined,
    areaId: selectedAreaId,
    gatewayId: selectedGatewayId,
    defaultSiteId: defaultSiteId,
  }), [debouncedSearchText, selectedAreaId, selectedGatewayId, defaultSiteId]);

  // Query for counting assets by area (without area filter)
  const { sql: areaCountSql, params: areaCountParams } = useMemo(() => buildAssetsQuery({
    search: debouncedSearchText || undefined,
    iotStatusId: selectedIotStatusId,
    gatewayId: selectedGatewayId,
    defaultSiteId: defaultSiteId,
  }), [debouncedSearchText, selectedIotStatusId, selectedGatewayId, defaultSiteId]);

  // Query for counting assets by gateway (without gateway filter)
  const { sql: gatewayCountSql, params: gatewayCountParams } = useMemo(() => buildAssetsQuery({
    search: debouncedSearchText || undefined,
    areaId: selectedAreaId,
    iotStatusId: selectedIotStatusId,
    defaultSiteId: defaultSiteId,
  }), [debouncedSearchText, selectedAreaId, selectedIotStatusId, defaultSiteId]);

  const { data: assets = [], isLoading } = useQuery<Asset>(sql, params);
  const { data: allFilteredAssets = [] } = useQuery<Asset>(countSql, countParams);
  const { data: allFilteredAssetsForArea = [] } = useQuery<Asset>(areaCountSql, areaCountParams);
  const { data: allFilteredAssetsForGateway = [] } = useQuery<Asset>(gatewayCountSql, gatewayCountParams);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

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

  const handleAssignGateway = () => {
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (asset) {
      setAssigningAssetId(contextMenuAssetId);
      setSelectedGatewayForAssign(asset.gateway_id || null);
      setAssignGatewayModalVisible(true);
      setContextMenuAssetId(null);
    }
  };

  const handleSaveGateway = async () => {
    if (!assigningAssetId) return;
    try {
      await assetService.updateAsset(assigningAssetId, { gateway_id: selectedGatewayForAssign || undefined });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setAssignGatewayModalVisible(false);
      setAssigningAssetId(null);
      setSelectedGatewayForAssign(null);
    } catch (error) {
      // Error updating gateway
      Alert.alert('Error', 'Failed to assign gateway. Please try again.');
    }
  };

  const handleAddImage = () => {
    const asset = assets.find(a => a.id === contextMenuAssetId);
    if (asset) {
      setCameraAssetId(contextMenuAssetId);
      setCameraModalVisible(true);
      setContextMenuAssetId(null);
    }
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

  const areaMap = useMemo(() => {
    return new Map(allAreas.map(a => [a.id, a.name]));
  }, [allAreas]);

  const iotStatusMap = useMemo(() => {
    return new Map(iotStatuses.map(s => [s.id, s.status || 'Unknown']));
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

  // Count assets by IoT status
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allFilteredAssets.forEach((asset) => {
      const statusId = asset.iot_status_id || 'none';
      counts.set(statusId, (counts.get(statusId) || 0) + 1);
    });
    return counts;
  }, [allFilteredAssets]);

  // Count assets by area
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allFilteredAssetsForArea.forEach((asset) => {
      const areaId = asset.area_id || 'none';
      counts.set(areaId, (counts.get(areaId) || 0) + 1);
    });
    return counts;
  }, [allFilteredAssetsForArea]);

  // Count assets by gateway
  const gatewayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allFilteredAssetsForGateway.forEach((asset) => {
      const gatewayId = asset.gateway_id || 'none';
      counts.set(gatewayId, (counts.get(gatewayId) || 0) + 1);
    });
    return counts;
  }, [allFilteredAssetsForGateway]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar value={searchText} onChangeText={handleSearchChange} placeholder="Search machines..." />
      
      <View style={styles.filtersContainer}>
        <TouchableOpacity 
          style={styles.filtersHeader}
          onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.filtersHeaderText}>Filters</Text>
          <Text style={styles.chevron}>{isFiltersExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {isFiltersExpanded && (
          <View>
            <FilterPanel
              label="Area"
              options={allAreas.map(a => {
                const count = areaCounts.get(a.id || '') || 0;
                return { 
                  id: a.id, 
                  label: `${a.name} (${count})` 
                };
              })}
              selectedId={selectedAreaId}
              onSelect={setSelectedAreaId}
            />
            
            <FilterPanel
              label="Gateway"
              options={gateways.map(g => {
                const count = gatewayCounts.get(g.id || '') || 0;
                return { 
                  id: g.id, 
                  label: `${g.code || 'Unknown'} (${count})` 
                };
              })}
              selectedId={selectedGatewayId}
              onSelect={setSelectedGatewayId}
            />
            
            <FilterPanel
              label="IoT Status"
              options={iotStatuses.map(s => {
                const count = statusCounts.get(s.id || '') || 0;
                return { 
                  id: s.id, 
                  label: `${s.status || 'Unknown'} (${count})` 
                };
              })}
              selectedId={selectedIotStatusId}
              onSelect={setSelectedIotStatusId}
            />
          </View>
        )}
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: fabBottom + 20 }}
        renderItem={({ item }) => {
          const areaName = item.area_id ? areaMap.get(item.area_id) : undefined;
          const iotStatus = item.iot_status_id ? iotStatusMap.get(item.iot_status_id) : undefined;
          const gateway = item.gateway_id ? gateways.find(g => g.id === item.gateway_id) : undefined;
          const gatewayName = gateway?.code || undefined;
          
          return (
            <AssetCard
              asset={item}
              areaName={areaName}
              iotStatus={iotStatus}
              gatewayName={gatewayName}
              onPress={() => router.push(`/machines/${item.id}`)}
              onLongPress={() => setContextMenuAssetId(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No machines found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => router.push('/machines/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

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
                      router.push(`/machines/${contextMenuAssetId}/edit`);
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
                    onPress={handleAssignGateway}
                  >
                    <Ionicons name="link-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Assign Gateway</Text>
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

      {/* Assign Gateway Modal */}
      <Modal
        visible={assignGatewayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignGatewayModalVisible(false)}
      >
        <View style={styles.inputModalOverlay}>
          <View style={styles.inputModalContent}>
            <Text style={styles.inputModalTitle}>Assign Gateway</Text>
            <SimplePicker
              value={selectedGatewayForAssign}
              options={gateways.map((gateway) => ({ label: gateway.code || 'Unnamed', value: gateway.id }))}
              onValueChange={(value) => setSelectedGatewayForAssign(value)}
              placeholder="Select Gateway"
            />
            <View style={styles.inputModalActions}>
              <TouchableOpacity
                style={[styles.inputModalButton, styles.inputModalButtonCancel]}
                onPress={() => {
                  setAssignGatewayModalVisible(false);
                  setAssigningAssetId(null);
                  setSelectedGatewayForAssign(null);
                }}
              >
                <Text style={styles.inputModalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inputModalButton, styles.inputModalButtonSave]}
                onPress={handleSaveGateway}
              >
                <Text style={styles.inputModalButtonSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal
        visible={cameraModalVisible}
        animationType="slide"
        onRequestClose={() => setCameraModalVisible(false)}
      >
        {cameraAssetId && (
          <CameraScreen
            onPhotosTaken={async (uris) => {
              try {
                const asset = assets.find(a => a.id === cameraAssetId);
                if (!asset) return;
                
                // Stagger adding images to the queue to avoid race conditions
                for (let i = 0; i < uris.length; i++) {
                  await imageService.uploadImage(uris[i], 'asset', cameraAssetId, asset.site_id);
                  // Add a small delay between each image to let PowerSync process them
                  if (i < uris.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
                  }
                }
                setCameraModalVisible(false);
                setCameraAssetId(null);
              } catch (error) {
                // Error uploading images
                // Only show error if it's not a network/offline error
                if (!isNetworkError(error)) {
                  Alert.alert('Error', 'Failed to upload some images. Please try again.');
                }
              }
            }}
            onClose={() => {
              setCameraModalVisible(false);
              setCameraAssetId(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
   fontSize: 16,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  filtersHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  chevron: {
    fontSize: 11,
    color: '#666',
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

