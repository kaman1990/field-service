import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@powersync/react';
import { useQuery as useReactQuery } from '@tanstack/react-query';
import { getTableName } from '../../../lib/powersync-queries';
import { useRouter } from 'expo-router';
import { lookupService } from '../../../services/lookups';
import type { Asset, Point, Gateway, AssetIotStatus, PointIotStatus, GatewayStatus } from '../../../types/database';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 49 : Platform.OS === 'android' ? 56 : 64;
  const bottomPadding = tabBarHeight + 20 + (Platform.OS !== 'web' ? insets.bottom : 0);
  
  // Get table names
  const assetsTable = getTableName('assets');
  const pointsTable = getTableName('points');
  const gatewaysTable = getTableName('gateways');

  // Build queries
  const assetsQuery = `SELECT id, name, internal_id, iot_status_id, image_count FROM ${assetsTable} WHERE enabled = ?`;
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

  // Query images table to get actual image counts per asset
  const imagesTable = getTableName('images');
  const { data: allImages = [] } = useQuery<{ id: string; asset_id: string | null; enabled: boolean }>(
    `SELECT id, asset_id, enabled FROM ${imagesTable} WHERE asset_id IS NOT NULL AND enabled = ?`,
    [1]
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

  // Calculate IoT status counts for assets with install progress
  const assetStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();
    let installed = 0;
    let partiallyInstalled = 0;
    let notInstalled = 0;
    let communicating = 0;

    allAssets.forEach((asset) => {
      // Count by IoT status
      const statusId = asset.iot_status_id || 'none';
      const status = assetIotStatuses.find(s => s.id === statusId);
      const statusKey = status?.status || 'No Status';
      const current = byStatus.get(statusKey) || { name: statusKey, count: 0 };
      byStatus.set(statusKey, { ...current, count: current.count + 1 });

      // Categorize for progress calculation
      const lowerStatus = statusKey.toLowerCase();
      if (lowerStatus.includes('communicating')) {
        communicating++;
      } else if (lowerStatus.includes('installed') && !lowerStatus.includes('partially') && !lowerStatus.includes('not')) {
        installed++;
      } else if (lowerStatus.includes('partially installed')) {
        partiallyInstalled++;
      } else if (lowerStatus.includes('not installed') || lowerStatus.includes('not mapped')) {
        notInstalled++;
      }
    });

    const total = allAssets.length;
    const completed = installed + communicating;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
      installed,
      partiallyInstalled,
      notInstalled,
      communicating,
      total,
      progress,
    };
  }, [allAssets, assetIotStatuses]);

  // Calculate IoT status counts for points with install progress
  const pointStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();
    let installed = 0;
    let partiallyInstalled = 0;
    let notInstalled = 0;
    let communicating = 0;

    allPoints.forEach((point) => {
      const statusId = point.iot_status_id || 'none';
      const status = pointIotStatuses.find(s => s.id === statusId);
      const statusKey = status?.status || 'No Status';
      const current = byStatus.get(statusKey) || { name: statusKey, count: 0 };
      byStatus.set(statusKey, { ...current, count: current.count + 1 });

      // Categorize for progress calculation
      const lowerStatus = statusKey.toLowerCase();
      if (lowerStatus.includes('communicating')) {
        communicating++;
      } else if (lowerStatus.includes('installed') && !lowerStatus.includes('partially') && !lowerStatus.includes('not')) {
        installed++;
      } else if (lowerStatus.includes('partially installed')) {
        partiallyInstalled++;
      } else if (lowerStatus.includes('not installed') || lowerStatus.includes('not mapped')) {
        notInstalled++;
      }
    });

    const total = allPoints.length;
    const completed = installed + communicating;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
      installed,
      partiallyInstalled,
      notInstalled,
      communicating,
      total,
      progress,
    };
  }, [allPoints, pointIotStatuses]);

  // Calculate assets missing images
  const assetsMissingImages = useMemo(() => {
    // Count images per asset
    const imageCountsByAsset = new Map<string, number>();
    allImages.forEach((image) => {
      if (image.asset_id) {
        const current = imageCountsByAsset.get(image.asset_id) || 0;
        imageCountsByAsset.set(image.asset_id, current + 1);
      }
    });

    // Find assets with no images
    const missing: Array<{ id: string; name: string; internal_id?: string }> = [];
    allAssets.forEach((asset) => {
      const imageCount = imageCountsByAsset.get(asset.id) || 0;
      // Also check image_count field if available
      const hasImages = imageCount > 0 || (asset.image_count && asset.image_count > 0);
      
      if (!hasImages) {
        missing.push({
          id: asset.id,
          name: asset.name || 'Unnamed Asset',
          internal_id: asset.internal_id,
        });
      }
    });

    return missing;
  }, [allAssets, allImages]);

  // Calculate status counts for gateways with install progress
  const gatewayStats = useMemo(() => {
    const byStatus = new Map<string, { name: string; count: number }>();
    let online = 0;
    let offline = 0;
    let installed = 0;
    let partiallyInstalled = 0;
    let notInstalled = 0;
    let communicating = 0;

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

      // Categorize for progress calculation
      const lowerStatus = statusKey.toLowerCase();
      if (lowerStatus.includes('communicating')) {
        communicating++;
      } else if (lowerStatus.includes('installed') && !lowerStatus.includes('partially') && !lowerStatus.includes('not')) {
        installed++;
      } else if (lowerStatus.includes('partially installed')) {
        partiallyInstalled++;
      } else if (lowerStatus.includes('not installed') || lowerStatus.includes('not mapped') || lowerStatus.includes('not required')) {
        notInstalled++;
      } else if (gateway.online === true) {
        // If online but no specific status, consider it communicating
        communicating++;
      }
    });

    const total = allGateways.length;
    const completed = installed + communicating;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      online,
      offline,
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.count - a.count),
      installed,
      partiallyInstalled,
      notInstalled,
      communicating,
      total,
      progress,
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
    <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}>
      <View style={styles.header}>
        <Text style={styles.siteName}>Field Asset Management</Text>
      </View>

      {/* Installation Progress Summary */}
      <View style={styles.progressSection}>
        <Text style={styles.sectionTitle}>Installation Progress</Text>
        
        <ProgressCard
          title="Machines"
          total={assetStats.total}
          completed={assetStats.installed + assetStats.communicating}
          partiallyInstalled={assetStats.partiallyInstalled}
          notInstalled={assetStats.notInstalled}
          progress={assetStats.progress}
          onPress={() => router.push('/(tabs)/machines')}
        />
        
        <ProgressCard
          title="Points"
          total={pointStats.total}
          completed={pointStats.installed + pointStats.communicating}
          partiallyInstalled={pointStats.partiallyInstalled}
          notInstalled={pointStats.notInstalled}
          progress={pointStats.progress}
          onPress={() => router.push('/(tabs)/machines/points')}
        />
        
        <ProgressCard
          title="Gateways"
          total={gatewayStats.total}
          completed={gatewayStats.installed + gatewayStats.communicating}
          partiallyInstalled={gatewayStats.partiallyInstalled}
          notInstalled={gatewayStats.notInstalled}
          progress={gatewayStats.progress}
          onPress={() => router.push('/(tabs)/gateways')}
        />
      </View>

      {/* Alerts Section */}
      {assetsMissingImages.length > 0 && (
        <View style={styles.alertsSection}>
          <AlertCard
            title="Missing Images"
            count={assetsMissingImages.length}
            icon="📷"
            color="#FF9800"
            items={assetsMissingImages.slice(0, 5)}
            onViewAll={() => router.push('/(tabs)/machines')}
            onItemPress={(assetId) => router.push(`/(tabs)/machines/${assetId}`)}
          />
        </View>
      )}

      {/* Detailed IoT Status Stats */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Status Breakdown</Text>

        {/* Assets Details */}
        <DetailCard title="Machines" icon="📦">
          {assetStats.byStatus.length > 0 ? (
            assetStats.byStatus.map((status) => (
              <VisualStatRow key={status.name} label={status.name} value={status.count} total={assetStats.total} />
            ))
          ) : (
            <VisualStatRow label="No Status" value={0} total={0} />
          )}
        </DetailCard>

        {/* Points Details */}
        <DetailCard title="Points" icon="📍">
          {pointStats.byStatus.length > 0 ? (
            pointStats.byStatus.map((status) => (
              <VisualStatRow key={status.name} label={status.name} value={status.count} total={pointStats.total} />
            ))
          ) : (
            <VisualStatRow label="No Status" value={0} total={0} />
          )}
        </DetailCard>

        {/* Gateways Details */}
        <DetailCard title="Gateways" icon="📡">
          {gatewayStats.byStatus.length > 0 ? (
            gatewayStats.byStatus.map((status) => (
              <VisualStatRow key={status.name} label={status.name} value={status.count} total={gatewaysCount} />
            ))
          ) : (
            <VisualStatRow label="No Status" value={0} total={0} />
          )}
          <View style={styles.statDivider} />
          <VisualStatRow label="Online" value={gatewayStats.online} total={gatewaysCount} />
          <VisualStatRow label="Offline" value={gatewayStats.offline} total={gatewaysCount} />
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

interface ProgressCardProps {
  title: string;
  total: number;
  completed: number;
  partiallyInstalled: number;
  notInstalled: number;
  progress: number;
  onPress?: () => void;
}

function ProgressCard({ title, total, completed, partiallyInstalled, notInstalled, progress, onPress }: ProgressCardProps) {
  const content = (
    <View style={styles.progressCard}>
      <View style={styles.progressCardHeader}>
        <Text style={styles.progressCardTitle}>{title}</Text>
        <Text style={styles.progressCardPercentage}>{Math.round(progress)}%</Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: getProgressColor(progress) }]} />
        </View>
      </View>
      
      <View style={styles.progressStats}>
        <ProgressStatItem label="Completed" value={completed} color="#4CAF50" />
        <ProgressStatItem label="Partial" value={partiallyInstalled} color="#FF9800" />
        <ProgressStatItem label="Not Installed" value={notInstalled} color="#9E9E9E" />
        <ProgressStatItem label="Total" value={total} color="#2196F3" />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface ProgressStatItemProps {
  label: string;
  value: number;
  color: string;
}

function ProgressStatItem({ label, value, color }: ProgressStatItemProps) {
  return (
    <View style={styles.progressStatItem}>
      <View style={[styles.progressStatDot, { backgroundColor: color }]} />
      <Text style={styles.progressStatLabel}>{label}:</Text>
      <Text style={[styles.progressStatValue, { color }]}>{value}</Text>
    </View>
  );
}

interface VisualStatRowProps {
  label: string;
  value: number;
  total: number;
}

function VisualStatRow({ label, value, total }: VisualStatRowProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const statusColor = getStatusColor(label);

  return (
    <View style={styles.visualStatRow}>
      <View style={styles.visualStatRowLeft}>
        <View style={[styles.visualStatDot, { backgroundColor: statusColor }]} />
        <Text style={styles.visualStatLabel}>{label}</Text>
      </View>
      <View style={styles.visualStatRowRight}>
        <View style={styles.visualStatBarContainer}>
          <View style={[styles.visualStatBar, { width: `${percentage}%`, backgroundColor: statusColor }]} />
        </View>
        <Text style={[styles.visualStatValue, { color: statusColor }]}>{value}</Text>
      </View>
    </View>
  );
}

function getStatusColor(status?: string): string {
  if (!status) return '#999';
  const lowerStatus = status.toLowerCase();
  
  // Specific status colors (checked first for priority)
  if (lowerStatus.includes('not installed') || lowerStatus.includes('not required') || lowerStatus.includes('not mapped')) {
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

function getProgressColor(progress: number): string {
  if (progress >= 80) return '#4CAF50'; // Green
  if (progress >= 50) return '#FF9800'; // Orange
  if (progress >= 25) return '#FFC107'; // Amber
  return '#9E9E9E'; // Gray
}

interface AlertCardProps {
  title: string;
  count: number;
  icon: string;
  color: string;
  items: Array<{ id: string; name: string; internal_id?: string }>;
  onViewAll?: () => void;
  onItemPress?: (id: string) => void;
}

function AlertCard({ title, count, icon, color, items, onViewAll, onItemPress }: AlertCardProps) {
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertCardHeader}>
        <View style={styles.alertCardHeaderLeft}>
          <Text style={styles.alertCardIcon}>{icon}</Text>
          <View>
            <Text style={styles.alertCardTitle}>{title}</Text>
            <Text style={styles.alertCardSubtitle}>{count} {count === 1 ? 'asset' : 'assets'} need attention</Text>
          </View>
        </View>
        <View style={[styles.alertCardBadge, { backgroundColor: color }]}>
          <Text style={styles.alertCardBadgeText}>{count}</Text>
        </View>
      </View>
      
      {items.length > 0 && (
        <View style={styles.alertCardItems}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.alertCardItem}
              onPress={() => onItemPress?.(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.alertCardItemDot, { backgroundColor: color }]} />
              <Text style={styles.alertCardItemText} numberOfLines={1}>
                {item.name}
                {item.internal_id && (
                  <Text style={styles.alertCardItemId}> ({item.internal_id})</Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
          {count > items.length && (
            <Text style={styles.alertCardMore}>+{count - items.length} more</Text>
          )}
        </View>
      )}
      
      {onViewAll && (
        <TouchableOpacity style={styles.alertCardAction} onPress={onViewAll} activeOpacity={0.7}>
          <Text style={[styles.alertCardActionText, { color }]}>View All →</Text>
        </TouchableOpacity>
      )}
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
  progressSection: {
    marginBottom: 24,
    gap: 16,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressCardPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  progressStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressStatLabel: {
    fontSize: 13,
    color: '#666',
  },
  progressStatValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  visualStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  visualStatRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  visualStatRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  visualStatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  visualStatLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  visualStatBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    maxWidth: 80,
  },
  visualStatBar: {
    height: '100%',
    borderRadius: 3,
  },
  visualStatValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'right',
  },
  alertsSection: {
    marginBottom: 24,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertCardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  alertCardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  alertCardBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  alertCardBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertCardItems: {
    marginBottom: 12,
    gap: 8,
  },
  alertCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  alertCardItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  alertCardItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  alertCardItemId: {
    fontSize: 13,
    color: '#666',
  },
  alertCardMore: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  alertCardAction: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  alertCardActionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});

