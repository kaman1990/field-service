import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery as useReactQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { Ionicons } from '@expo/vector-icons';
import { GatewayCard } from '../../../components/GatewayCard';
import { SearchBar } from '../../../components/SearchBar';
import { FilterPanel } from '../../../components/FilterPanel';
import { lookupService } from '../../../services/lookups';
import { gatewayService } from '../../../services/gateways';
import { buildGatewaysQuery } from '../../../lib/powersync-queries';
import { getPowerSync } from '../../../lib/powersync';
import type { Gateway, Area, GatewayStatus, GatewayIotStatus } from '../../../types/database';

export default function GatewayListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>();
  const [selectedIotStatusId, setSelectedIotStatusId] = useState<string | undefined>();
  const [selectedConnectionType, setSelectedConnectionType] = useState<string | undefined>();
  const [contextMenuGatewayId, setContextMenuGatewayId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ gatewayId: string; statusId: string | null; reason: string; isIotStatus?: boolean } | null>(null);

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
          const lookupTablePatterns = ['areas', 'gateway_status', 'gateway_iot_status'];
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
            queryClient.invalidateQueries({ queryKey: ['allGatewayStatuses'] });
            queryClient.invalidateQueries({ queryKey: ['gatewayIotStatuses'] });
          }
        },
        onError: (error: any) => {
          // Error watching PowerSync changes
        }
      }, {
        tables: ['areas', 'gateway_status', 'gateway_iot_status'],
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

  const { data: statuses = [] } = useReactQuery<GatewayStatus[]>({
    queryKey: ['allGatewayStatuses'],
    queryFn: () => lookupService.getGatewayStatuses(),
  });

  const { data: gatewayIotStatuses = [] } = useReactQuery<GatewayIotStatus[]>({
    queryKey: ['gatewayIotStatuses'],
    queryFn: () => lookupService.getGatewayIotStatuses(),
  });

  // Find status IDs for "not required" and "not installed"
  const notRequiredStatusId = useMemo(() => {
    const status = statuses.find(s => s.status?.toLowerCase().includes('not required'));
    return status?.id || null;
  }, [statuses]);

  const notInstalledStatusId = useMemo(() => {
    const status = statuses.find(s => s.status?.toLowerCase().includes('not installed'));
    return status?.id || null;
  }, [statuses]);

  // Find IoT status IDs for "not required" and "not installed"
  const notRequiredIotStatusId = useMemo(() => {
    const status = gatewayIotStatuses.find(s => s.status?.toLowerCase().includes('not required'));
    return status?.id || null;
  }, [gatewayIotStatuses]);

  const notInstalledIotStatusId = useMemo(() => {
    const status = gatewayIotStatuses.find(s => s.status?.toLowerCase().includes('not installed'));
    return status?.id || null;
  }, [gatewayIotStatuses]);

  const { sql, params } = useMemo(() => {
    try {
      return buildGatewaysQuery({
        search: debouncedSearchText || undefined,
        areaId: selectedAreaId,
        statusId: selectedStatusId,
        iotStatusId: selectedIotStatusId,
        connectionType: selectedConnectionType,
      });
    } catch (error) {
      // Error building query
      return { sql: '', params: [] };
    }
  }, [debouncedSearchText, selectedAreaId, selectedStatusId, selectedIotStatusId, selectedConnectionType]);

  // Query for counting gateways by status (without status filter)
  const { sql: countSql, params: countParams } = useMemo(() => buildGatewaysQuery({
    search: debouncedSearchText || undefined,
    areaId: selectedAreaId,
    statusId: selectedStatusId,
    connectionType: selectedConnectionType,
  }), [debouncedSearchText, selectedAreaId, selectedStatusId, selectedConnectionType]);

  // Query for counting gateways by IoT status (without IoT status filter, but respects other filters)
  const { sql: iotCountSql, params: iotCountParams } = useMemo(() => buildGatewaysQuery({
    search: debouncedSearchText || undefined,
    areaId: selectedAreaId,
    statusId: selectedStatusId,
    connectionType: selectedConnectionType,
  }), [debouncedSearchText, selectedAreaId, selectedStatusId, selectedConnectionType]);

  const { data: gateways = [], isLoading } = useQuery<Gateway>(sql || 'SELECT * FROM gateways WHERE 1=0', params);
  const { data: allFilteredGateways = [] } = useQuery<Gateway>(countSql || 'SELECT * FROM gateways WHERE 1=0', countParams);
  const { data: allFilteredGatewaysForIot = [] } = useQuery<Gateway>(iotCountSql || 'SELECT * FROM gateways WHERE 1=0', iotCountParams);

  const connectionTypes = useMemo(() => {
    return Array.from(new Set(gateways.map(g => g.connection_type).filter(Boolean)));
  }, [gateways]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const handleAddNote = () => {
    const gateway = gateways.find(g => g.id === contextMenuGatewayId);
    if (gateway) {
      setEditingGatewayId(contextMenuGatewayId);
      setNoteInput(gateway.notes || '');
      setNoteModalVisible(true);
      setContextMenuGatewayId(null);
    }
  };

  const handleSaveNote = async () => {
    if (!editingGatewayId) return;
    try {
      const updateData: { notes: string; status_id?: string | null; iot_status_id?: string | null } = { notes: noteInput };
      
      // If there's a pending status update, include it
      if (pendingStatusUpdate && pendingStatusUpdate.gatewayId === editingGatewayId) {
        if (pendingStatusUpdate.isIotStatus) {
          updateData.iot_status_id = pendingStatusUpdate.statusId as any;
        } else {
          updateData.status_id = pendingStatusUpdate.statusId as any;
        }
      }
      
      await gatewayService.updateGateway(editingGatewayId, updateData);
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      setNoteModalVisible(false);
      setNoteInput('');
      setEditingGatewayId(null);
      setPendingStatusUpdate(null);
    } catch (error) {
      // Error updating note
      Alert.alert('Error', 'Failed to update note. Please try again.');
    }
  };

  const handleSetNotRequired = async () => {
    if (!contextMenuGatewayId) return;
    const gateway = gateways.find(g => g.id === contextMenuGatewayId);
    if (!gateway) return;
    
    const isCurrentlyNotRequired = gateway.status_id === notRequiredStatusId;
    
    if (!notRequiredStatusId && !isCurrentlyNotRequired) {
      Alert.alert('Error', 'Could not find "Not Required" status.');
      setContextMenuGatewayId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotRequired) {
      try {
        await gatewayService.updateGateway(contextMenuGatewayId, { status_id: null });
        queryClient.invalidateQueries({ queryKey: ['gateways'] });
        setContextMenuGatewayId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuGatewayId(null);
    setEditingGatewayId(contextMenuGatewayId);
    setPendingStatusUpdate({ gatewayId: contextMenuGatewayId, statusId: notRequiredStatusId!, reason: 'Not Required' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleSetNotInstalled = async () => {
    if (!contextMenuGatewayId) return;
    const gateway = gateways.find(g => g.id === contextMenuGatewayId);
    if (!gateway) return;
    
    const isCurrentlyNotInstalled = gateway.status_id === notInstalledStatusId;
    
    if (!notInstalledStatusId && !isCurrentlyNotInstalled) {
      Alert.alert('Error', 'Could not find "Not Installed" status.');
      setContextMenuGatewayId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotInstalled) {
      try {
        await gatewayService.updateGateway(contextMenuGatewayId, { status_id: null });
        queryClient.invalidateQueries({ queryKey: ['gateways'] });
        setContextMenuGatewayId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuGatewayId(null);
    setEditingGatewayId(contextMenuGatewayId);
    setPendingStatusUpdate({ gatewayId: contextMenuGatewayId, statusId: notInstalledStatusId!, reason: 'Not Installed' });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleSetIotNotRequired = async () => {
    if (!contextMenuGatewayId) return;
    const gateway = gateways.find(g => g.id === contextMenuGatewayId);
    if (!gateway) return;
    
    const isCurrentlyNotRequired = gateway.iot_status_id === notRequiredIotStatusId;
    
    if (!notRequiredIotStatusId && !isCurrentlyNotRequired) {
      Alert.alert('Error', 'Could not find "Not Required" IoT status.');
      setContextMenuGatewayId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotRequired) {
      try {
        await gatewayService.updateGateway(contextMenuGatewayId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['gateways'] });
        setContextMenuGatewayId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update IoT status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuGatewayId(null);
    setEditingGatewayId(contextMenuGatewayId);
    setPendingStatusUpdate({ gatewayId: contextMenuGatewayId, statusId: notRequiredIotStatusId!, reason: 'Not Required (IoT)', isIotStatus: true });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const handleSetIotNotInstalled = async () => {
    if (!contextMenuGatewayId) return;
    const gateway = gateways.find(g => g.id === contextMenuGatewayId);
    if (!gateway) return;
    
    const isCurrentlyNotInstalled = gateway.iot_status_id === notInstalledIotStatusId;
    
    if (!notInstalledIotStatusId && !isCurrentlyNotInstalled) {
      Alert.alert('Error', 'Could not find "Not Installed" IoT status.');
      setContextMenuGatewayId(null);
      return;
    }
    
    // If clearing, update immediately without note
    if (isCurrentlyNotInstalled) {
      try {
        await gatewayService.updateGateway(contextMenuGatewayId, { iot_status_id: null });
        queryClient.invalidateQueries({ queryKey: ['gateways'] });
        setContextMenuGatewayId(null);
      } catch (error) {
        // Error updating status
        Alert.alert('Error', 'Failed to update IoT status. Please try again.');
      }
      return;
    }
    
    // If setting, prompt for note first
    setContextMenuGatewayId(null);
    setEditingGatewayId(contextMenuGatewayId);
    setPendingStatusUpdate({ gatewayId: contextMenuGatewayId, statusId: notInstalledIotStatusId!, reason: 'Not Installed (IoT)', isIotStatus: true });
    setNoteInput('');
    setNoteModalVisible(true);
  };

  const areaMap = useMemo(() => {
    return new Map(allAreas.map(a => [a.id, a.name]));
  }, [allAreas]);

  const statusMap = useMemo(() => {
    return new Map(statuses.map(s => [s.id, s.status || 'Unknown']));
  }, [statuses]);

  const gatewayIotStatusMap = useMemo(() => {
    return new Map(gatewayIotStatuses.map(s => [s.id, s.status || 'Unknown']));
  }, [gatewayIotStatuses]);

  // Count gateways by status
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allFilteredGateways.forEach((gateway) => {
      const statusId = gateway.status_id || 'none';
      counts.set(statusId, (counts.get(statusId) || 0) + 1);
    });
    return counts;
  }, [allFilteredGateways]);

  // Count gateways by IoT status
  const iotStatusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allFilteredGatewaysForIot.forEach((gateway) => {
      const statusId = gateway.iot_status_id || 'none';
      counts.set(statusId, (counts.get(statusId) || 0) + 1);
    });
    return counts;
  }, [allFilteredGatewaysForIot]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar value={searchText} onChangeText={handleSearchChange} placeholder="Search gateways..." />
      
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
              options={allAreas.map(a => ({ id: a.id, label: a.name }))}
              selectedId={selectedAreaId}
              onSelect={setSelectedAreaId}
            />
            
            <FilterPanel
              label="Status"
              options={statuses.map(s => {
                const count = statusCounts.get(s.id || '') || 0;
                return { 
                  id: s.id, 
                  label: `${s.status || 'Unknown'} (${count})` 
                };
              })}
              selectedId={selectedStatusId}
              onSelect={setSelectedStatusId}
            />
            
            <FilterPanel
              label="IoT Status"
              options={gatewayIotStatuses.map(s => {
                const count = iotStatusCounts.get(s.id || '') || 0;
                return { 
                  id: s.id, 
                  label: `${s.status || 'Unknown'} (${count})` 
                };
              })}
              selectedId={selectedIotStatusId}
              onSelect={setSelectedIotStatusId}
            />
            
            <FilterPanel
              label="Connection Type"
              options={connectionTypes.map(ct => ({ id: ct!, label: ct! }))}
              selectedId={selectedConnectionType}
              onSelect={setSelectedConnectionType}
            />
          </View>
        )}
      </View>

      <FlatList
        data={gateways}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const areaName = item.area_id ? areaMap.get(item.area_id) : undefined;
          const status = item.status_id ? statusMap.get(item.status_id) : undefined;
          const iotStatus = item.iot_status_id ? gatewayIotStatusMap.get(item.iot_status_id) : undefined;
          
          return (
            <GatewayCard
              gateway={item}
              areaName={areaName}
              status={status}
              iotStatus={iotStatus}
              onPress={() => router.push(`/gateways/${item.id}`)}
              onLongPress={() => setContextMenuGatewayId(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No gateways found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/gateways/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Context Menu Modal */}
      <Modal
        visible={!!contextMenuGatewayId}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenuGatewayId(null)}
      >
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuGatewayId(null)}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            {(() => {
              const currentGateway = gateways.find(g => g.id === contextMenuGatewayId);
              const isNotRequired = currentGateway?.status_id === notRequiredStatusId;
              const isNotInstalled = currentGateway?.status_id === notInstalledStatusId;
              const isIotNotRequired = currentGateway?.iot_status_id === notRequiredIotStatusId;
              const isIotNotInstalled = currentGateway?.iot_status_id === notInstalledIotStatusId;
              
              return (
                <>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      setContextMenuGatewayId(null);
                      router.push(`/gateways/${contextMenuGatewayId}/edit`);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Edit Gateway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleAddNote}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#333" />
                    <Text style={styles.contextMenuText}>Add Note</Text>
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
                  
                  <View style={styles.contextMenuDivider} />
                  
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleSetIotNotRequired}
                  >
                    <Ionicons 
                      name={isIotNotRequired ? "checkmark-circle" : "close-circle-outline"} 
                      size={20} 
                      color={isIotNotRequired ? "#4CAF50" : "#333"} 
                    />
                    <Text style={[styles.contextMenuText, isIotNotRequired && styles.contextMenuTextActive]}>
                      Set IoT to Not Required
                    </Text>
                    {isIotNotRequired && (
                      <Ionicons name="checkmark" size={18} color="#4CAF50" style={styles.contextMenuCheckmark} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={handleSetIotNotInstalled}
                  >
                    <Ionicons 
                      name={isIotNotInstalled ? "checkmark-circle" : "remove-circle-outline"} 
                      size={20} 
                      color={isIotNotInstalled ? "#4CAF50" : "#333"} 
                    />
                    <Text style={[styles.contextMenuText, isIotNotInstalled && styles.contextMenuTextActive]}>
                      Set IoT to Not Installed
                    </Text>
                    {isIotNotInstalled && (
                      <Ionicons name="checkmark" size={18} color="#4CAF50" style={styles.contextMenuCheckmark} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.contextMenuItem, styles.contextMenuCancel]}
                    onPress={() => setContextMenuGatewayId(null)}
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
                  setEditingGatewayId(null);
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
    bottom: 20,
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
