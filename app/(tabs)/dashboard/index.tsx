import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@powersync/react';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { getTableName } from '../../../lib/powersync-queries';
import { useRouter } from 'expo-router';
import { lookupService } from '../../../services/lookups';
import type { Asset, Point, Gateway, AssetIotStatus, PointIotStatus, GatewayStatus } from '../../../types/database';

export default function DashboardScreen() {
  const router = useRouter();
  
  // Get table names
  const assetsTable = getTableName('assets');
  const pointsTable = getTableName('points');
  const gatewaysTable = getTableName('gateways');

  // Build queries
  const assetsQuery = `SELECT id, iot_status_id FROM ${assetsTable} WHERE enabled = ?`;
  const assetsParams = [1];

  const pointsQuery = `SELECT id, iot_status_id FROM ${pointsTable} WHERE enabled = ?`;
  const pointsParams = [1];

  const gatewaysQuery = `SELECT id, status_id, online FROM ${gatewaysTable} WHERE enabled = ?`;
  const gatewaysParams = [1];

  // Query all entities for detailed stats
  const { data: allAssets = [], isLoading: assetsLoading } = useQuery<Asset>(
    assetsQuery,
    assetsParams
  );

  const { data: allPoints = [], isLoading: pointsLoading } = useQuery<Point>(
    pointsQuery,
    pointsParams
  );

  const { data: allGateways = [], isLoading: gatewaysLoading } = useQuery<Gateway>(
    gatewaysQuery,
    gatewaysParams
  );

  // Get lookup tables
  const { data: assetIotStatuses = [] } = useReactQuery<AssetIotStatus[]>({
    queryKey: ['assetIotStatuses'],
    queryFn: () => lookupService.getAssetIotStatuses(),
  });

  const { data: pointIotStatuses = [] } = useReactQuery<PointIotStatus[]>({
    queryKey: ['pointIotStatuses'],
    queryFn: () => lookupService.getPointIotStatuses(),
  });

  const { data: gatewayStatuses = [] } = useReactQuery<GatewayStatus[]>({
    queryKey: ['gatewayStatuses'],
    queryFn: () => lookupService.getGatewayStatuses(),
  });

  const isLoading = assetsLoading || pointsLoading || gatewaysLoading;

  // Calculate totals
  const assetsCount = allAssets.length;
  const pointsCount = allPoints.length;
  const gatewaysCount = allGateways.length;

  // Calculate IoT status counts for assets
  const assetStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();

    allAssets.forEach((asset) => {
      // Count by IoT status
      const statusId = asset.iot_status_id || 'none';
      const status = assetIotStatuses.find(s => s.id === statusId);
      const statusKey = status?.status || 'No Status';
      const current = byStatus.get(statusKey) || { name: statusKey, count: 0 };
      byStatus.set(statusKey, { ...current, count: current.count + 1 });
    });

    return {
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
    };
  }, [allAssets, assetIotStatuses]);

  // Calculate IoT status counts for points
  const pointStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();

    allPoints.forEach((point) => {
      const statusId = point.iot_status_id || 'none';
      const status = pointIotStatuses.find(s => s.id === statusId);
      const statusKey = status?.status || 'No Status';
      const current = byStatus.get(statusKey) || { name: statusKey, count: 0 };
      byStatus.set(statusKey, { ...current, count: current.count + 1 });
    });

    return {
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
    };
  }, [allPoints, pointIotStatuses]);

  // Calculate status counts for gateways
  const gatewayStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();
    let online = 0;
    let offline = 0;

    allGateways.forEach((gateway) => {
      // Count online/offline
      if (gateway.online === true) {
        online++;
      } else {
        offline++;
      }

      // Track by status
      const statusId = gateway.status_id || 'none';
      const status = gatewayStatuses.find(s => s.id === statusId);
      const statusKey = status?.status || 'No Status';
      const current = byStatus.get(statusKey) || { name: statusKey, count: 0 };
      byStatus.set(statusKey, { ...current, count: current.count + 1 });
    });

    return {
      online,
      offline,
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
    };
  }, [allGateways, gatewayStatuses]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.siteName}>Field Asset Management</Text>
      </View>

      <View style={styles.statsContainer}>
        <StatCard
          title="Assets"
          count={assetsCount}
          icon="📦"
          onPress={() => router.push('/(tabs)/assets')}
        />
        
        <StatCard
          title="Points"
          count={pointsCount}
          icon="📍"
          onPress={() => router.push('/(tabs)/assets/points')}
        />
        
        <StatCard
          title="Gateways"
          count={gatewaysCount}
          icon="📡"
          onPress={() => router.push('/(tabs)/gateways')}
        />
      </View>

      {/* Detailed IoT Status Stats */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>IoT Status</Text>

        {/* Assets Details */}
        <DetailCard title="Assets" icon="📦">
          {assetStats.byStatus.length > 0 ? (
            assetStats.byStatus.map((status) => (
              <StatRow key={status.name} label={status.name} value={status.count} />
            ))
          ) : (
            <StatRow label="No Status" value={0} />
          )}
        </DetailCard>

        {/* Points Details */}
        <DetailCard title="Points" icon="📍">
          {pointStats.byStatus.length > 0 ? (
            pointStats.byStatus.map((status) => (
              <StatRow key={status.name} label={status.name} value={status.count} />
            ))
          ) : (
            <StatRow label="No Status" value={0} />
          )}
        </DetailCard>

        {/* Gateways Details */}
        <DetailCard title="Gateways" icon="📡">
          {gatewayStats.byStatus.length > 0 ? (
            gatewayStats.byStatus.map((status) => (
              <StatRow key={status.name} label={status.name} value={status.count} />
            ))
          ) : (
            <StatRow label="No Status" value={0} />
          )}
          <View style={styles.statDivider} />
          <StatRow label="Online" value={gatewayStats.online} />
          <StatRow label="Offline" value={gatewayStats.offline} />
        </DetailCard>
      </View>
    </ScrollView>
  );
}

interface StatCardProps {
  title: string;
  count: number;
  icon: string;
  onPress?: () => void;
}

function StatCard({ title, count, icon, onPress }: StatCardProps) {
  const content = (
    <>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.statCard}>
      {content}
    </View>
  );
}

interface DetailCardProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function DetailCard({ title, icon, children }: DetailCardProps) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <Text style={styles.detailCardIcon}>{icon}</Text>
        <Text style={styles.detailCardTitle}>{title}</Text>
      </View>
      <View style={styles.detailCardContent}>
        {children}
      </View>
    </View>
  );
}

interface StatRowProps {
  label: string;
  value: number;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  siteName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statsContainer: {
    gap: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  detailsSection: {
    marginTop: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailCardIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  detailCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  detailCardContent: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statRowLabel: {
    fontSize: 15,
    color: '#666',
  },
  statRowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  statDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
});

