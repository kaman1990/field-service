import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { useQuery } from '@powersync/react';
import { PointCard } from '../../../../components/PointCard';
import { SearchBar } from '../../../../components/SearchBar';
import { FilterPanel } from '../../../../components/FilterPanel';
import { lookupService } from '../../../../services/lookups';
import { buildPointsQuery } from '../../../../lib/powersync-queries';
import type { Point, Gateway, PointIotStatus } from '../../../../types/database';

export default function PointListScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | undefined>();
  const [selectedIotStatusId, setSelectedIotStatusId] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data: gateways = [] } = useReactQuery<Gateway[]>({
    queryKey: ['gateways'],
    queryFn: () => lookupService.getGateways(),
  });

  const { data: iotStatuses = [] } = useReactQuery<PointIotStatus[]>({
    queryKey: ['pointIotStatuses'],
    queryFn: () => lookupService.getPointIotStatuses(),
  });

  const { sql, params } = useMemo(() => buildPointsQuery(assetId!, {
    search: debouncedSearchText || undefined,
    gatewayId: selectedGatewayId,
    iotStatusId: selectedIotStatusId,
  }), [assetId, debouncedSearchText, selectedGatewayId, selectedIotStatusId]);

  const { data: points = [], isLoading } = useQuery<Point>(sql, params);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar value={searchText} onChangeText={handleSearchChange} placeholder="Search points..." />
      
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
              label="Gateway"
              options={gateways.map(g => ({ id: g.id, label: g.code || 'Unnamed' }))}
              selectedId={selectedGatewayId}
              onSelect={setSelectedGatewayId}
            />
            
            <FilterPanel
              label="IoT Status"
              options={iotStatuses.map(s => ({ id: s.id, label: s.status || 'Unknown' }))}
              selectedId={selectedIotStatusId}
              onSelect={setSelectedIotStatusId}
            />
          </View>
        )}
      </View>

      <FlatList
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PointCard
            point={item}
            onPress={() => router.push(`/assets/points/${item.id}?assetId=${assetId}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No points found</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/assets/points/new?assetId=${assetId}`)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
});
