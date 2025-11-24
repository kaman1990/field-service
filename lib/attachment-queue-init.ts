import { AttachmentQueue } from './attachment-queue';
import { SupabaseStorageAdapter } from './storage-adapter';
import { getPowerSync } from './powersync';
import { AttachmentState } from '@powersync/attachments';
import { generateThumbnail } from './image-thumbnail';
import { Platform } from 'react-native';

let attachmentQueueInstance: AttachmentQueue | null = null;

/**
 * Get or create the AttachmentQueue instance
 */
export const getAttachmentQueue = (): AttachmentQueue | null => {
  if (!attachmentQueueInstance) {
    try {
      const powerSync = getPowerSync();
      if (!powerSync) {
        return null;
      }

      const storageAdapter = new SupabaseStorageAdapter();
      
      attachmentQueueInstance = new AttachmentQueue({
        powersync: powerSync,
        storage: storageAdapter,
        syncInterval: 5000,
        cacheLimit: 1000,
        performInitialSync: true,
        downloadAttachments: true,
      });
    } catch (error) {
      return null;
    }
  }
  
  return attachmentQueueInstance;
};

/**
 * Initialize the AttachmentQueue
 * Should be called after PowerSync is connected
 */
export const initializeAttachmentQueue = async (): Promise<void> => {
  const queue = getAttachmentQueue();
  if (!queue) {
    return;
  }

  await queue.init();
  
  // Set up watcher to generate thumbnails for newly synced images
  setupThumbnailGenerationWatcher(queue);
};

/**
 * Watch for attachments that reach SYNCED state and generate thumbnails
 */
function setupThumbnailGenerationWatcher(queue: AttachmentQueue): void {
  const powerSync = getPowerSync();
  if (!powerSync) {
    return;
  }

  // Watch for attachments that just reached SYNCED state
  // This will trigger thumbnail generation in the background
  powerSync.watch(
    `SELECT id, filename, local_uri, media_type FROM attachments 
     WHERE state = ${AttachmentState.SYNCED} 
     AND (media_type LIKE 'image/%' OR filename LIKE '%.jpg' OR filename LIKE '%.jpeg' 
          OR filename LIKE '%.png' OR filename LIKE '%.gif' OR filename LIKE '%.webp')`,
    [],
    {
      onResult: async (result: any) => {
        const attachments = result.rows?._array || [];
        
        // Generate thumbnails in background for each synced image
        for (const attachment of attachments) {
          // Check if thumbnail already exists
          const { getThumbnailUri } = await import('./image-thumbnail');
          const existingThumbnail = await getThumbnailUri(attachment.filename);
          
          if (!existingThumbnail && attachment.local_uri) {
            // Generate thumbnail asynchronously without blocking
            generateThumbnailForSyncedAttachment(queue, attachment).catch((error) => {
              // Silently fail - thumbnail will be generated on-demand if needed
              console.debug('Background thumbnail generation failed:', error.message);
            });
          }
        }
      },
    }
  );
}

/**
 * Generate thumbnail for a synced attachment
 */
async function generateThumbnailForSyncedAttachment(
  queue: AttachmentQueue,
  attachment: { filename: string; local_uri: string; media_type?: string }
): Promise<void> {
  try {
    const localUri = queue.getLocalUri(attachment.local_uri);
    const storageAdapter = (queue as any).storage;
    
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
    if (Platform.OS === 'web') {
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
      
      const extension = attachment.filename.split('.').pop()?.toLowerCase();
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
    await generateThumbnail(sourceUri, attachment.filename);
  } catch (error) {
    // Silently fail - thumbnail will be generated on-demand if needed
  }
}
