import { AttachmentQueue } from './attachment-queue';
import { SupabaseStorageAdapter } from './storage-adapter';
import { getPowerSync } from './powersync';

let attachmentQueueInstance: AttachmentQueue | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get or create the AttachmentQueue instance
 */
export const getAttachmentQueue = (): AttachmentQueue | null => {
  if (!attachmentQueueInstance) {
    try {
      const powerSync = getPowerSync();
      if (!powerSync) {
        console.log('[AttachmentQueue] PowerSync instance not available');
        return null;
      }

      const storageAdapter = new SupabaseStorageAdapter();
      
      attachmentQueueInstance = new AttachmentQueue({
        powersync: powerSync,
        storage: storageAdapter,
        syncInterval: 30000, // Sync every 30 seconds
        cacheLimit: 100, // Keep last 100 attachments
        performInitialSync: true,
        downloadAttachments: true, // Enable automatic downloads
        downloadConcurrency: 5, // Reduced from 30 to 5 to limit concurrent connections
      });
    } catch (error) {
      console.error('[AttachmentQueue] Failed to create AttachmentQueue instance:', error);
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
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const queue = getAttachmentQueue();
      if (!queue) {
        console.log('[AttachmentQueue] AttachmentQueue not available, skipping initialization');
        return;
      }

      await queue.init();
      console.log('[AttachmentQueue] Initialized successfully');
      
      // Trigger uploads immediately after initialization to catch any pending uploads
      // This is especially useful when coming back online
      setTimeout(() => {
        queue.triggerUploads().catch((error) => {
          console.error('[AttachmentQueue] Error triggering initial uploads:', error);
        });
      }, 2000); // Wait 2 seconds after init to ensure everything is set up
    } catch (error) {
      console.error('[AttachmentQueue] Initialization failed:', error);
      initializationPromise = null; // Reset so we can retry
      throw error;
    }
  })();

  return initializationPromise;
};

/**
 * Manually trigger uploads for pending attachments
 * Useful when connectivity is restored
 */
export const triggerAttachmentUploads = async (): Promise<void> => {
  const queue = getAttachmentQueue();
  if (!queue) {
    console.log('[AttachmentQueue] AttachmentQueue not available, cannot trigger uploads');
    return;
  }
  
  await queue.triggerUploads();
};

