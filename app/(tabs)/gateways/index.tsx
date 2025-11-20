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
import type { Gateway, Area, GatewayStatus } from '../../../types/database';

export default function GatewayListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>();
  const [selectedConnectionType, setSelectedConnectionType] = useState<string | undefined>();
  const [contextMenuGatewayId, setContextMenuGatewayId] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ gatewayId: string; statusId: string | null; reason: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data: areas = [] } = useReactQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => lookupService.getAreas(),
  });

  const { data: statuses = [] } = useReactQuery<GatewayStatus[]>({
    queryKey: ['gatewayStatuses'],
    queryFn: () => lookupService.getGatewayStatuses(),
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

  const { sql, params } = useMemo(() => {
    try {
      return buildGatewaysQuery({
        search: debouncedSearchText || undefined,
        areaId: selectedAreaId,
        statusId: selectedStatusId,
        connectionType: selectedConnectionType,
      });
    } catch (error) {
      console.error('[Gateways] Error building query:', error);
      return { sql: '', params: [] };
    }
  }, [debouncedSearchText, selectedAreaId, selectedStatusId, selectedConnectionType]);

  const { data: gateways = [], isLoading } = useQuery<Gateway>(sql || 'SELECT * FROM gateways WHERE 1=0', params);

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
      const updateData: { notes: string; status_id?: string | null } = { notes: noteInput };
      
      // If there's a pending status update, include it
      if (pendingStatusUpdate && pendingStatusUpdate.gatewayId === editingGatewayId) {
        updateData.status_id = pendingStatusUpdate.statusId as any;
      }
      
      await gatewayService.updateGateway(editingGatewayId, updateData);
      queryClient.invalidateQueries({ queryKey: ['gateways'] });
      setNoteModalVisible(false);
      setNoteInput('');
      setEditingGatewayId(null);
      setPendingStatusUpdate(null);
    } catch (error) {
      console.error('Error updating note:', error);
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
        console.error('Error updating status:', error);
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
        console.error('Error updating status:', error);
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
              options={areas.map(a => ({ id: a.id, label: a.name }))}
              selectedId={selectedAreaId}
              onSelect={setSelectedAreaId}
            />
            
            <FilterPanel
              label="Status"
              options={statuses.map(s => ({ id: s.id, label: s.status || 'Unknown' }))}
              selectedId={selectedStatusId}
              onSelect={setSelectedStatusId}
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
        renderItem={({ item }) => (
          <GatewayCard
            gateway={item}
            onPress={() => router.push(`/gateways/${item.id}`)}
            onLongPress={() => setContextMenuGatewayId(item.id)}
          />
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  filtersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  chevron: {
    fontSize: 12,
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
