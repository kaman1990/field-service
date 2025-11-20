import { AbstractAttachmentQueue, AttachmentState, AttachmentRecord, AttachmentQueueOptions } from '@powersync/attachments';
import { getPowerSync } from './powersync';

/**
 * Generate a UUID v4 compatible string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Interface for extended AttachmentQueue options with download concurrency
 */
export interface ExtendedAttachmentQueueOptions extends AttachmentQueueOptions {
  /**
   * Maximum number of concurrent downloads. Defaults to 5.
   */
  downloadConcurrency?: number;
}

/**
 * AttachmentQueue implementation for syncing attachments with PowerSync
 * Links attachments to images in the images table via image_id
 * Overrides downloadRecords to support parallel downloads
 */
export class AttachmentQueue extends AbstractAttachmentQueue {
  private downloadConcurrency: number;
  private activeDownloads: Set<string> = new Set();
  private uploadCheckInterval: NodeJS.Timeout | null = null;

  constructor(options: ExtendedAttachmentQueueOptions) {
    super(options);
    this.downloadConcurrency = options.downloadConcurrency ?? 5;
  }

  /**
   * Watch for attachment IDs that need to be synced
   * image_id now contains the filename (e.g., "uuid.jpg"), so we extract the UUID part
   * to match with the attachments table id
   */
  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    const powerSync = getPowerSync();
    
    // Watch for image_id values in the images table that are not null
    // image_id now contains the filename (e.g., "uuid.jpg"), extract UUID part (filename without extension)
    powerSync.watch(
      'SELECT image_id FROM images WHERE image_id IS NOT NULL AND enabled = 1',
      [],
      {
        onResult: (result: any) => {
          const filenames = (result.rows?._array?.map((r: any) => r.image_id) ?? []) as string[];
          // Extract UUID from filename (remove extension)
          const ids = filenames.map((filename: string) => {
            // Remove extension to get UUID
            return filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
          });
          
          // Remove duplicates (in case same ID appears multiple times)
          const uniqueIds = Array.from(new Set(ids));
          
          this.logger.debug(`[AttachmentQueue] onAttachmentIdsChange: Found ${filenames.length} images, ${uniqueIds.length} unique attachment IDs`);
          
          onUpdate(uniqueIds);
        },
      }
    );
  }

  /**
   * Create a new attachment record
   * Called when an attachment ID is not found in the attachments table
   */
  async newAttachmentRecord(record?: Partial<AttachmentRecord>): Promise<AttachmentRecord> {
    const attachmentId = record?.id ?? generateUUID();
    const filename = record?.filename ?? `${attachmentId}.jpg`;
    
    return {
      id: attachmentId,
      filename,
      media_type: record?.media_type || 'image/jpeg',
      state: AttachmentState.QUEUED_UPLOAD, // Assume we're uploading a new file
      size: record?.size,
      local_uri: record?.local_uri,
      timestamp: Date.now(),
      ...record,
    };
  }

  /**
   * Override watchUploads to ensure uploads are properly triggered
   * This ensures uploads happen when connectivity is restored
   */
  watchUploads(): void {
    this.logger.debug('[AttachmentQueue] Setting up upload watcher...');
    super.watchUploads();
    
    // Clear any existing interval to prevent duplicates
    if (this.uploadCheckInterval) {
      clearInterval(this.uploadCheckInterval);
    }
    
    // Also manually trigger uploads periodically to catch any missed uploads
    // This is especially important when coming back online
    // Increased interval to reduce connection pressure
    this.uploadCheckInterval = setInterval(() => {
      try {
        this.trigger();
      } catch (error: any) {
        this.logger.error('[AttachmentQueue] Error in periodic upload check:', error);
      }
    }, 30000); // Increased from 10 seconds to 30 seconds to reduce connection pressure
  }

  /**
   * Manually trigger uploads for pending attachments
   * Useful when connectivity is restored
   */
  async triggerUploads(): Promise<void> {
    try {
      // Just call the parent's trigger method
      this.trigger();
    } catch (error) {
      this.logger.error('[AttachmentQueue] Error triggering uploads:', error);
    }
  }

  /**
   * Custom downloadRecords implementation to support parallel downloads with concurrency limit
   * This processes multiple downloads simultaneously instead of one at a time
   */
  private async downloadRecordsInternal(): Promise<void> {
    if (!this.options.downloadAttachments) {
      return;
    }
    if (this.downloading) {
      return;
    }

    // Get all IDs that need to be downloaded
    const idsToDownload = await this.getIdsToDownload();
    idsToDownload.forEach((id) => this.downloadQueue.add(id));

    if (this.downloadQueue.size === 0) {
      return;
    }

    this.downloading = true;
    try {
      this.logger.debug(`Downloading ${this.downloadQueue.size} attachments with concurrency limit of ${this.downloadConcurrency}...`);
      
      // Map to track active download promises by ID
      const activePromises = new Map<string, Promise<void>>();
      
      // Process downloads with concurrency control
      while (this.downloadQueue.size > 0 || activePromises.size > 0) {
        // Start new downloads up to the concurrency limit
        while (activePromises.size < this.downloadConcurrency && this.downloadQueue.size > 0) {
          const id = this.downloadQueue.values().next().value;
          if (!id) break;
          
          this.downloadQueue.delete(id);
          this.activeDownloads.add(id);
          
          const downloadPromise = (async () => {
            try {
              const record = await this.record(id);
              if (record) {
                await this.downloadRecord(record);
              }
            } catch (error) {
              this.logger.error(`Download failed for attachment ${id}:`, error);
            } finally {
              this.activeDownloads.delete(id);
              activePromises.delete(id);
            }
          })();
          
          activePromises.set(id, downloadPromise);
        }
        
        // If we've reached the concurrency limit and have more to download, wait for one to complete
        if (activePromises.size >= this.downloadConcurrency && this.downloadQueue.size > 0) {
          await Promise.race(Array.from(activePromises.values()));
        }
        
        // Small delay to prevent tight loop when queue is empty but downloads are in progress
        if (this.downloadQueue.size === 0 && activePromises.size > 0) {
          await Promise.race(Array.from(activePromises.values()));
        }
      }
      
      this.logger.debug('Finished downloading attachments');
    } catch (e) {
      this.logger.error('Downloads failed:', e);
    } finally {
      this.downloading = false;
      this.activeDownloads.clear();
    }
  }

  /**
   * Override downloadRecord to use the correct filename from image_id
   * This ensures we use the actual filename stored in the images table,
   * which may differ from the attachment record's filename
   */
  async downloadRecord(record: AttachmentRecord): Promise<boolean> {
    const powerSync = getPowerSync();
    
    // Try to find the correct filename from the images table
    // image_id contains the filename (e.g., "uuid.png"), so we can look it up
    try {
      // Find image record where image_id matches the filename pattern for this attachment ID
      // The attachment ID is the UUID part (without extension)
      const imageRecord = await powerSync.get<{ image_id: string }>(
        `SELECT image_id FROM images 
         WHERE image_id LIKE ? AND enabled = 1 
         LIMIT 1`,
        [`${record.id}.%`]
      );
      
      if (imageRecord?.image_id && imageRecord.image_id !== record.filename) {
        // Found a different filename in the images table - use that instead
        this.logger.debug(`[AttachmentQueue] Using filename from image_id: ${imageRecord.image_id} (attachment record had: ${record.filename})`);
        
        // Create a modified record with the correct filename
        const correctedRecord: AttachmentRecord = {
          ...record,
          filename: imageRecord.image_id,
        };
        
        // Call parent's downloadRecord with corrected filename
        return await super.downloadRecord(correctedRecord);
      }
    } catch (error: any) {
      // If lookup fails, log but continue with original filename
      this.logger.debug(`[AttachmentQueue] Could not lookup filename from images table for ${record.id}:`, error?.message);
    }
    
    // Fall back to parent's implementation with original filename
    return await super.downloadRecord(record);
  }

  /**
   * Override trigger to use our custom downloadRecords
   */
  trigger(): void {
    // Use parent's upload logic
    super.trigger();
    
    // Use our custom downloadRecords for parallel downloads
    this.downloadRecordsInternal().catch((error: any) => {
      this.logger.error('[AttachmentQueue] Error in downloadRecords:', error);
    });
  }
}
