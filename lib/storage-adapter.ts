import { StorageAdapter, EncodingType } from '@powersync/attachments';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { Platform } from 'react-native';
import { isNetworkError } from './error-utils';

// Bucket name for Supabase Storage
const STORAGE_BUCKET = 'images';

// Initialize IndexedDB store for file storage on web
const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = window.indexedDB.open('PowerSyncFileStorage', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'uri' });
      }
    };
  });
};

// Cache for IndexedDB instance
let indexedDBCache: IDBDatabase | null = null;
const getDB = async (): Promise<IDBDatabase> => {
  if (!indexedDBCache) {
    indexedDBCache = await initIndexedDB();
  }
  return indexedDBCache;
};

// Export getDB for use in other modules
export const getIndexedDB = getDB;

/**
 * StorageAdapter implementation for Supabase Storage
 * Handles both local file operations (using Expo FileSystem) and cloud storage (using Supabase Storage)
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(filePath: string, data: ArrayBuffer, options?: { mediaType?: string }): Promise<void> {
    try {
      // Check if we have network connectivity before attempting upload
      // If offline, throw an error that will be caught and retried later
      const { data: testData, error: testError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list('', { limit: 1 });
      
      // If we can't even list (network error), we're offline
      if (testError && (testError.message.includes('network') || testError.message.includes('fetch') || testError.message.includes('Failed to fetch'))) {
        throw new Error(`Network error: ${testError.message}`);
      }

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, data, {
          contentType: options?.mediaType || 'application/octet-stream',
          upsert: true, // Overwrite if exists
        });

      if (error) {
        // Don't treat "duplicate" as success when we're actually trying to upload
        // Only mark as duplicate if the error specifically says the file exists
        if (error.message && error.message.toLowerCase().includes('already exists')) {
          // File already exists - this is actually a success case
          // But we should still throw to let the caller handle it
          throw { error: 'Duplicate', message: error.message };
        }
        throw new Error(`Failed to upload file to Supabase Storage: ${error.message}`);
      }
    } catch (error: any) {
      // Only log as error if it's not a network/offline error
      // Network errors are expected when offline - attachments are queued and will upload when back online
      if (isNetworkError(error)) {
        // Log network errors at debug level instead of error level
        console.debug('[StorageAdapter] Upload error (network/offline - will retry when online):', error);
      } else {
        console.error('[StorageAdapter] Upload error:', error);
      }
      // Re-throw with the original error structure if it's a duplicate
      if (error.error === 'Duplicate') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Download a file from Supabase Storage
   * Tries multiple paths in parallel (resized version, original, and alternative extensions)
   * Tries authenticated download first (works for both public and private buckets),
   * falls back to public URL if authenticated download fails
   * Returns the first successful download
   */
  async downloadFile(filePath: string): Promise<Blob> {
    const tryDownload = async (path: string): Promise<Blob | null> => {
      try {
        // First, try authenticated download (works for both public and private buckets)
        const { data, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(path);

        if (!downloadError && data) {
          console.log(`[StorageAdapter] Successfully downloaded via authenticated method: ${path} (${data.size} bytes)`);
          return data;
        }

        // Log the error for debugging (but don't fail yet - try public URL)
        if (downloadError) {
          console.debug(`[StorageAdapter] Authenticated download failed for ${path}: ${downloadError.message}`);
        }

        // If authenticated download fails, try public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        
        if (!urlData?.publicUrl) {
          console.debug(`[StorageAdapter] Could not get public URL for ${path}`);
          return null;
        }

        // Fetch from public URL
        const response = await fetch(urlData.publicUrl);
        
        if (response.ok) {
          const blob = await response.blob();
          console.log(`[StorageAdapter] Successfully downloaded from public URL: ${path} (${blob.size} bytes)`);
          return blob;
        }
        
        console.debug(`[StorageAdapter] Public URL fetch failed for ${path}: ${response.status} ${response.statusText}`);
        return null;
      } catch (error: any) {
        console.debug(`[StorageAdapter] Exception while trying to download ${path}:`, error?.message || error);
        return null;
      }
    };

    try {
      // Build list of paths to try in parallel (ordered by preference)
      // Since image_id contains the filename with extension, we know the exact format
      // and don't need to try alternative extensions
      const pathsToTry: string[] = [
        `resized/${filePath}`, // Try resized version first (most common case)
        filePath, // Try original file path
      ];

      console.log(`[StorageAdapter] Attempting to download: ${filePath} (trying ${pathsToTry.length} paths)`);

      // Try all paths in parallel and return the first successful result
      // We prioritize by order: resized first, then original
      const downloadPromises = pathsToTry.map((path, index) => 
        tryDownload(path).then(blob => ({ path, blob, priority: index }))
      );

      // Race all downloads - return as soon as any succeeds
      // But we need to check priority to ensure we prefer resized over alternatives
      const results = await Promise.allSettled(downloadPromises);
      
      // Find successful downloads and return the one with highest priority (lowest index)
      const successful: Array<{ path: string; blob: Blob; priority: number }> = [];
      const failed: Array<{ path: string; reason?: string }> = [];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const path = pathsToTry[i];
        
        if (result.status === 'fulfilled' && result.value.blob) {
          successful.push(result.value);
        } else {
          failed.push({ 
            path,
            reason: result.status === 'rejected' ? result.reason?.message : 'No blob returned'
          });
        }
      }

      if (successful.length > 0) {
        // Sort by priority and return the best match
        successful.sort((a, b) => a.priority - b.priority);
        console.log(`[StorageAdapter] Successfully downloaded ${filePath} from: ${successful[0].path}`);
        return successful[0].blob;
      }

      // If all attempts fail, throw error with details
      const failedPaths = failed.map(f => `${f.path}${f.reason ? ` (${f.reason})` : ''}`).join(', ');
      throw new Error(`Failed to download file from Supabase Storage: ${filePath}. Tried: ${failedPaths}`);
    } catch (error: any) {
      console.error('[StorageAdapter] Download error:', error);
      throw error;
    }
  }

  /**
   * Write a file to local storage using Expo FileSystem
   */
  async writeFile(fileUri: string, base64Data: string, options?: { encoding?: EncodingType }): Promise<void> {
    // FileSystem operations are not available on web - use IndexedDB instead
    if (Platform.OS === 'web') {
      try {
        const db = await getDB();
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        await new Promise<void>((resolve, reject) => {
          const request = store.put({
            uri: fileUri,
            data: base64Data,
            encoding: options?.encoding || EncodingType.Base64,
            timestamp: Date.now(),
          });
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        console.log(`[StorageAdapter] Stored file in IndexedDB: ${fileUri}`);
      } catch (error: any) {
        console.error('[StorageAdapter] Failed to store file in IndexedDB:', error);
        throw new Error(`Failed to store file in IndexedDB: ${error.message}`);
      }
      return;
    }
    
    try {
      const encoding = options?.encoding || EncodingType.Base64;
      
      // Ensure directory exists
      const dirUri = fileUri.substring(0, fileUri.lastIndexOf('/'));
      const dirInfo = await FileSystem.getInfoAsync(dirUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
      }

      // Write file
      const isBase64 = encoding === EncodingType.Base64;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: isBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
      });
    } catch (error: any) {
      console.error('[StorageAdapter] Write file error:', error);
      throw error;
    }
  }

  /**
   * Read a file from local storage
   */
  async readFile(fileUri: string, options?: { encoding?: EncodingType; mediaType?: string }): Promise<ArrayBuffer> {
    // FileSystem operations are not available on web - use IndexedDB instead
    if (Platform.OS === 'web') {
      try {
        const db = await getDB();
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        const fileData = await new Promise<any>((resolve, reject) => {
          const request = store.get(fileUri);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (!fileData) {
          throw new Error(`File does not exist in IndexedDB: ${fileUri}`);
        }
        
        const base64Data = fileData.data;
        const encoding = options?.encoding || fileData.encoding || EncodingType.Base64;
        const isBase64 = encoding === EncodingType.Base64;
        
        // Convert string to ArrayBuffer
        if (isBase64) {
          // Decode base64 to binary
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        } else {
          // UTF8 encoding
          const encoder = new TextEncoder();
          return encoder.encode(base64Data).buffer;
        }
      } catch (error: any) {
        console.error('[StorageAdapter] Failed to read file from IndexedDB:', error);
        throw new Error(`File does not exist in IndexedDB: ${fileUri}`);
      }
    }
    
    try {
      const encoding = options?.encoding || EncodingType.Base64;
      const isBase64 = encoding === EncodingType.Base64;
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${fileUri}`);
      }

      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: isBase64 
          ? FileSystem.EncodingType.Base64 
          : FileSystem.EncodingType.UTF8,
      });

      // Convert string to ArrayBuffer
      if (isBase64) {
        // Decode base64 to binary
        const binaryString = atob(content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      } else {
        // UTF8 encoding
        const encoder = new TextEncoder();
        return encoder.encode(content).buffer;
      }
    } catch (error: any) {
      console.error('[StorageAdapter] Read file error:', error);
      throw error;
    }
  }

  /**
   * Delete a file from both local storage and Supabase Storage
   */
  async deleteFile(uri: string, options?: { filename?: string }): Promise<void> {
    try {
      // Delete from local storage
      if (Platform.OS === 'web') {
        try {
          const db = await getDB();
          const transaction = db.transaction(['files'], 'readwrite');
          const store = transaction.objectStore('files');
          
          await new Promise<void>((resolve, reject) => {
            const request = store.delete(uri);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (error: any) {
          console.error('[StorageAdapter] Failed to delete file from IndexedDB:', error);
          // Don't throw - continue with cloud deletion
        }
      } else {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }

      // Delete from Supabase Storage if filename is provided
      if (options?.filename) {
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([options.filename]);

        if (error) {
          console.log('[StorageAdapter] Failed to delete file from Supabase Storage:', error);
          // Don't throw - local deletion succeeded
        }
      }
    } catch (error: any) {
      console.error('[StorageAdapter] Delete file error:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in local storage
   */
  async fileExists(fileUri: string): Promise<boolean> {
    // FileSystem operations are not available on web - check IndexedDB instead
    if (Platform.OS === 'web') {
      try {
        const db = await getDB();
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        
        const fileData = await new Promise<any>((resolve, reject) => {
          const request = store.get(fileUri);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        return !!fileData;
      } catch (error: any) {
        return false;
      }
    }
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      return fileInfo.exists;
    } catch (error: any) {
      console.error('[StorageAdapter] File exists check error:', error);
      return false;
    }
  }

  /**
   * Create a directory
   */
  async makeDir(uri: string): Promise<void> {
    // FileSystem operations are not available on web
    if (Platform.OS === 'web') {
      // On web, directories are created automatically when files are written
      // No need to create directories explicitly
      return;
    }
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(uri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
      }
    } catch (error: any) {
      console.error('[StorageAdapter] Make dir error:', error);
      throw error;
    }
  }

  /**
   * Copy a file from source to target
   */
  async copyFile(sourceUri: string, targetUri: string): Promise<void> {
    // FileSystem operations are not available on web
    if (Platform.OS === 'web') {
      // On web, read from source and write to target
      // Since we can't use FileSystem, we'll read the file content and write it
      try {
        const sourceData = await this.readFile(sourceUri);
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(sourceData)));
        await this.writeFile(targetUri, base64Data);
      } catch (error: any) {
        console.error('[StorageAdapter] Copy file error:', error);
        throw error;
      }
      return;
    }
    
    try {
      // Ensure target directory exists
      const targetDir = targetUri.substring(0, targetUri.lastIndexOf('/'));
      const targetDirInfo = await FileSystem.getInfoAsync(targetDir);
      if (!targetDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      }

      // Copy file
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri,
      });
    } catch (error: any) {
      console.error('[StorageAdapter] Copy file error:', error);
      throw error;
    }
  }

  /**
   * Get the user storage directory
   * Returns the directory where user data is stored, should end with '/'
   */
  getUserStorageDirectory(): string {
    // FileSystem operations are not available on web
    if (Platform.OS === 'web') {
      // On web, return a virtual directory path
      // Files will be stored in cloud storage instead
      return '/web-storage/';
    }
    
    // Use Expo FileSystem document directory (legacy API)
    const baseDir = FileSystem.documentDirectory || '';
    
    // Ensure it ends with '/'
    if (!baseDir.endsWith('/')) {
      return baseDir + '/';
    }
    
    return baseDir;
  }
}

