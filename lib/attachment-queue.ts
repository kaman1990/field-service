import { AbstractAttachmentQueue, AttachmentState, AttachmentRecord, AttachmentQueueOptions } from '@powersync/attachments';
import { getPowerSync } from './powersync';
import { generateThumbnail } from './image-thumbnail';

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
 * Simple AttachmentQueue implementation for syncing attachments with PowerSync
 * Based on PowerSync's standard attachment queue pattern
 */
export class AttachmentQueue extends AbstractAttachmentQueue {
  constructor(options: AttachmentQueueOptions) {
    super(options);
  }

  /**
   * Watch for attachment IDs that need to be synced
   * This watches the images table for image_id values that correspond to attachments
   */
  onAttachmentIdsChange(onUpdate: (ids: string[]) => void): void {
    const powerSync = getPowerSync();
    
    // Watch for image_id values in the images table that are not null
    // image_id contains the filename (e.g., "uuid.jpg"), extract UUID part (filename without extension)
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
          
          // Remove duplicates
          const uniqueIds = Array.from(new Set(ids));
          
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
      state: AttachmentState.QUEUED_UPLOAD,
      size: record?.size,
      local_uri: record?.local_uri,
      timestamp: Date.now(),
      ...record,
    };
  }

  /**
   * Override to generate thumbnails after attachment is downloaded and synced
   * This is called by PowerSync when an attachment reaches SYNCED state
   * Note: This method may not exist in AbstractAttachmentQueue, but PowerSync
   * may call it if available. If not, thumbnails will be generated on-demand.
   */
  async onAttachmentSynced?(record: AttachmentRecord): Promise<void> {
    // Generate thumbnail in background (don't block)
    // Only for image files
    const isImage = record.media_type?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(record.filename);
    
    if (isImage && record.local_uri) {
      // Generate thumbnail asynchronously without blocking
      this.generateThumbnailForAttachment(record).catch((error) => {
        // Silently fail - thumbnail will be generated on-demand if needed
        console.debug('Background thumbnail generation failed:', error.message);
      });
    }
  }

  /**
   * Generate thumbnail for a synced attachment
   */
  private async generateThumbnailForAttachment(record: AttachmentRecord): Promise<void> {
    try {
      const localUri = this.getLocalUri(record.local_uri);
      const storageAdapter = (this as any).storage;
      
      if (!storageAdapter) {
        return;
      }
      
      // Check if file exists
      const exists = await storageAdapter.fileExists(localUri);
      if (!exists) {
        return;
      }
      
      // Get the file URI for thumbnail generation
      let sourceUri: string;
      if (typeof window !== 'undefined' && window.indexedDB) {
        // Web platform - convert IndexedDB to data URI
        const { getIndexedDB } = await import('./storage-adapter');
        const db = await getIndexedDB();
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        const fileData = await new Promise<any>((resolve, reject) => {
          const request = store.get(localUri);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (!fileData || !fileData.data) {
          return;
        }
        
        const extension = record.filename.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (extension === 'png') {
          mimeType = 'image/png';
        } else if (extension === 'gif') {
          mimeType = 'image/gif';
        } else if (extension === 'webp') {
          mimeType = 'image/webp';
        }
        
        sourceUri = `data:${mimeType};base64,${fileData.data}`;
      } else {
        // Native platform - use file URI directly
        sourceUri = localUri;
      }
      
      // Generate thumbnail
      await generateThumbnail(sourceUri, record.filename);
    } catch (error) {
      // Silently fail - thumbnail will be generated on-demand if needed
    }
  }
}
