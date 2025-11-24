import { getPowerSync, getInitializedPowerSync } from '../lib/powersync';
import { getAttachmentQueue } from '../lib/attachment-queue-init';
import { AttachmentState } from '@powersync/attachments';

export interface SyncStatus {
  pendingUploads: number;
  pendingDownloads: number;
  pendingSync: number;
  synced: number;
  powerSyncQueueCount: number;
  powerSyncQueueSize?: number;
}

export interface PendingAttachment {
  id: string;
  filename: string;
  state: number;
  stateName: string;
  size?: number;
  timestamp: number;
}

export const syncService = {
  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const powerSync = await getInitializedPowerSync();
      const attachmentQueue = getAttachmentQueue();

      // Get attachment stats
      let pendingUploads = 0;
      let pendingDownloads = 0;
      let pendingSync = 0;
      let synced = 0;

      if (attachmentQueue) {
        const attachments = await powerSync.getAll<{
          id: string;
          state: number;
          filename: string;
        }>(
          `SELECT id, state, filename FROM attachments WHERE state < ${AttachmentState.ARCHIVED}`
        );

        attachments.forEach((att) => {
          if (att.state === AttachmentState.QUEUED_UPLOAD) {
            pendingUploads++;
          } else if (att.state === AttachmentState.QUEUED_DOWNLOAD) {
            pendingDownloads++;
          } else if (att.state === AttachmentState.QUEUED_SYNC) {
            pendingSync++;
          } else if (att.state === AttachmentState.SYNCED) {
            synced++;
          }
        });
      }

      // Get PowerSync upload queue stats
      let powerSyncQueueCount = 0;
      let powerSyncQueueSize: number | undefined;
      try {
        const stats = await powerSync.getUploadQueueStats(true);
        powerSyncQueueCount = stats.count;
        powerSyncQueueSize = stats.size;
      } catch (error) {
        // Failed to get PowerSync queue stats
      }

      return {
        pendingUploads,
        pendingDownloads,
        pendingSync,
        synced,
        powerSyncQueueCount,
        powerSyncQueueSize,
      };
    } catch (error: any) {
      throw new Error(`Failed to get sync status: ${error.message}`);
    }
  },

  /**
   * Get list of pending attachments
   */
  async getPendingAttachments(): Promise<PendingAttachment[]> {
    try {
      const powerSync = await getInitializedPowerSync();
      const attachmentQueue = getAttachmentQueue();

      if (!attachmentQueue) {
        return [];
      }

      const attachments = await powerSync.getAll<{
        id: string;
        filename: string;
        state: number;
        size?: number;
        timestamp: number;
      }>(
        `SELECT id, filename, state, size, timestamp 
         FROM attachments 
         WHERE state < ${AttachmentState.ARCHIVED} 
         ORDER BY timestamp ASC`
      );

      const stateNames: Record<number, string> = {
        [AttachmentState.QUEUED_SYNC]: 'Queued for Sync',
        [AttachmentState.QUEUED_UPLOAD]: 'Queued for Upload',
        [AttachmentState.QUEUED_DOWNLOAD]: 'Queued for Download',
        [AttachmentState.SYNCED]: 'Synced',
        [AttachmentState.ARCHIVED]: 'Archived',
      };

      return attachments.map((att) => ({
        id: att.id,
        filename: att.filename,
        state: att.state,
        stateName: stateNames[att.state] || `Unknown (${att.state})`,
        size: att.size,
        timestamp: att.timestamp,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get pending attachments: ${error.message}`);
    }
  },

  /**
   * Force a sync attempt by resetting pending attachments to QUEUED_SYNC state
   * This will trigger the AttachmentQueue to re-evaluate and sync them
   */
  async forceSync(): Promise<void> {
    try {
      const powerSync = await getInitializedPowerSync();
      const attachmentQueue = getAttachmentQueue();

      if (!attachmentQueue) {
        throw new Error('AttachmentQueue is not available');
      }

      // Reset all pending uploads/downloads to QUEUED_SYNC to trigger re-evaluation
      await powerSync.execute(
        `UPDATE attachments 
         SET state = ${AttachmentState.QUEUED_SYNC}, timestamp = ${Date.now()} 
         WHERE state IN (${AttachmentState.QUEUED_UPLOAD}, ${AttachmentState.QUEUED_DOWNLOAD})`
      );

      // The AttachmentQueue watch queries will pick this up and trigger sync
    } catch (error: any) {
      throw new Error(`Failed to force sync: ${error.message}`);
    }
  },
};

