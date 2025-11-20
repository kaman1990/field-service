import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { syncService, type PendingAttachment } from '../services/sync';
import { getPowerSync, getInitializedPowerSync } from '../lib/powersync';
import { AttachmentState } from '@powersync/attachments';

interface UploadStatusProps {
  refreshInterval?: number;
}

export const UploadStatus: React.FC<UploadStatusProps> = ({ refreshInterval = 2000 }) => {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [allAttachments, setAllAttachments] = useState<PendingAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [stateCounts, setStateCounts] = useState<Record<number, number>>({});

  const loadPendingAttachments = async () => {
    try {
      setLoading(true);
      const attachments = await syncService.getPendingAttachments();
      
      // Store all attachments for debug view
      setAllAttachments(attachments);
      
      // Filter to only show upload-related states
      const uploadAttachments = attachments.filter(
        (att) => att.state === AttachmentState.QUEUED_UPLOAD || att.state === AttachmentState.QUEUED_SYNC
      );
      
      // Calculate state counts for debug display
      const counts = attachments.reduce((acc, att) => {
        acc[att.state] = (acc[att.state] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      setStateCounts(counts);
      
      setPendingAttachments(uploadAttachments);
    } catch (error) {
      console.error('[UploadStatus] Error loading pending attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingAttachments();
    const interval = setInterval(loadPendingAttachments, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStateName = (state: number): string => {
    const stateNames: Record<number, string> = {
      [AttachmentState.QUEUED_SYNC]: 'QUEUED_SYNC',
      [AttachmentState.QUEUED_UPLOAD]: 'QUEUED_UPLOAD',
      [AttachmentState.QUEUED_DOWNLOAD]: 'QUEUED_DOWNLOAD',
      [AttachmentState.SYNCED]: 'SYNCED',
      [AttachmentState.ARCHIVED]: 'ARCHIVED',
    };
    return stateNames[state] || `Unknown (${state})`;
  };

  // Always show if there are any attachments or if loading
  if (allAttachments.length === 0 && !loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {loading ? (
              <ActivityIndicator size="small" color="#ff9500" style={styles.loader} />
            ) : (
              <View style={[styles.indicator, pendingAttachments.length > 0 && styles.indicatorPending]} />
            )}
            <Text style={styles.headerText}>
              {pendingAttachments.length === 0
                ? 'No pending uploads'
                : `${pendingAttachments.length} pending upload${pendingAttachments.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          {pendingAttachments.length > 0 && (
            <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.listContainer}>
          {/* Debug Info Toggle */}
          <TouchableOpacity
            style={styles.debugToggle}
            onPress={() => setShowDebug(!showDebug)}
          >
            <Text style={styles.debugToggleText}>
              {showDebug ? '▼' : '▶'} Debug Info
            </Text>
          </TouchableOpacity>

          {showDebug && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Information</Text>
              <Text style={styles.debugText}>Total Attachments: {allAttachments.length}</Text>
              <Text style={styles.debugText}>Pending Uploads: {pendingAttachments.length}</Text>
              
              <Text style={styles.debugSubtitle}>State Breakdown:</Text>
              {Object.entries(stateCounts).map(([state, count]) => (
                <View key={state} style={styles.debugRow}>
                  <Text style={styles.debugText}>
                    {getStateName(Number(state))}: {count}
                  </Text>
                </View>
              ))}

              {allAttachments.length > 0 && (
                <>
                  <Text style={styles.debugSubtitle}>All Attachments:</Text>
                  {allAttachments.map((att) => (
                    <View key={att.id} style={styles.debugAttachmentItem}>
                      <Text style={styles.debugText} numberOfLines={1}>
                        {att.filename || att.id.substring(0, 8)}... - {getStateName(att.state)}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Pending Uploads List */}
          {pendingAttachments.length > 0 ? (
            pendingAttachments.map((att) => (
              <View key={att.id} style={styles.attachmentItem}>
                <View style={styles.attachmentHeader}>
                  <Text style={styles.filename} numberOfLines={1}>
                    {att.filename || att.id}
                  </Text>
                  <Text style={styles.state}>{att.stateName}</Text>
                </View>
                <View style={styles.attachmentDetails}>
                  {att.size && (
                    <Text style={styles.detailText}>{formatBytes(att.size)}</Text>
                  )}
                  <Text style={styles.detailText}>•</Text>
                  <Text style={styles.detailText}>{formatTimestamp(att.timestamp)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No pending uploads
                {allAttachments.length > 0 && ` (${allAttachments.length} total attachments)`}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  header: {
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  indicatorPending: {
    backgroundColor: '#ff9500',
  },
  loader: {
    marginRight: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  listContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    paddingBottom: 8,
  },
  attachmentItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  debugToggle: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  debugToggleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  debugContainer: {
    padding: 12,
    backgroundColor: '#fff9e6',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  debugRow: {
    paddingVertical: 2,
  },
  debugAttachmentItem: {
    paddingVertical: 2,
    paddingLeft: 8,
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  filename: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  state: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
  },
  attachmentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
});

