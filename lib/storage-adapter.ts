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
      const contentType = options?.mediaType || 'application/octet-stream';
      
      // IMPORTANT: Check browser DevTools → Network tab to see the actual request
      // Look for a request to /storage/v1/object/images/{filename}
      // Check if it's a CORS error, 401 (auth), 403 (permissions), or something else
      
      // Direct upload
      const { data: uploadData, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, data, {
          contentType: contentType,
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
          return data;
        }

        // If authenticated download fails, try public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        
        if (!urlData?.publicUrl) {
          return null;
        }

        // Fetch from public URL
        const response = await fetch(urlData.publicUrl);
        
        if (response.ok) {
          const blob = await response.blob();
          return blob;
        }
        
        return null;
      } catch (error: any) {
        return null;
      }
    };

    try {
      // filePath is the full storage path from image_id (e.g., "resized/filename_w250" or "filename")
      // Use it directly without any path construction
      const blob = await tryDownload(filePath);
      if (blob) {
        return blob;
      }

      // If download fails, throw error
      throw new Error(`Failed to download file from Supabase Storage: ${filePath}`);
    } catch (error: any) {
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
      } catch (error: any) {
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
          // Don't throw - continue with cloud deletion
        }
      } else {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }

      // Intentionally avoid deleting from Supabase Storage to prevent data loss.
      // Remote cleanup must be handled server-side or via explicit tooling.
    } catch (error: any) {
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

