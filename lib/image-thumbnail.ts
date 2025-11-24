import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getIndexedDB } from './storage-adapter';
import { EncodingType } from '@powersync/attachments';

/**
 * Generate a thumbnail for an image
 * Resizes to 150x150 (matching gallery size) with quality 0.8
 * 
 * @param sourceUri - URI of the full-size image (file://, data:, or IndexedDB URI)
 * @param filename - Original filename (e.g., "uuid.jpg")
 * @returns URI of the generated thumbnail, or null if generation fails
 */
export async function generateThumbnail(
  sourceUri: string,
  filename: string
): Promise<string | null> {
  try {
    // Ensure filename has an extension, default to .jpg if missing
    let normalizedFilename = filename;
    if (!filename.includes('.')) {
      // If no extension, assume it's a UUID or base name, add .jpg extension
      normalizedFilename = `${filename}.jpg`;
    }
    
    // Determine thumbnail filename
    const extension = normalizedFilename.split('.').pop()?.toLowerCase() || 'jpg';
    const baseName = normalizedFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    const thumbnailFilename = `${baseName}_thumb.${extension}`;

    // Resize image to 150x150
    const manipResult = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 150, height: 150 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const thumbnailUri = manipResult.uri;

    // Convert thumbnail to base64 for storage
    let base64Data: string;
    
    if (Platform.OS === 'web') {
      // On web, ImageManipulator returns a data URI or blob URL
      if (thumbnailUri.startsWith('data:')) {
        // Extract base64 from data URI
        const commaIndex = thumbnailUri.indexOf(',');
        if (commaIndex === -1) {
          throw new Error('Invalid data URI format');
        }
        base64Data = thumbnailUri.substring(commaIndex + 1);
      } else if (thumbnailUri.startsWith('blob:')) {
        // Fetch blob URL and convert to base64
        const response = await fetch(thumbnailUri);
        const blob = await response.blob();
        base64Data = await blobToBase64(blob);
      } else {
        // Try to fetch as regular URL
        const response = await fetch(thumbnailUri);
        const blob = await response.blob();
        base64Data = await blobToBase64(blob);
      }
    } else {
      // On native, read from file system
      base64Data = await FileSystem.readAsStringAsync(thumbnailUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Clean up temporary file created by ImageManipulator
      try {
        await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Store thumbnail in local storage
    const thumbnailStorageUri = await storeThumbnail(thumbnailFilename, base64Data);
    
    return thumbnailStorageUri;
  } catch (error: any) {
    console.warn('Failed to generate thumbnail:', error.message);
    return null;
  }
}

/**
 * Store thumbnail in local storage (IndexedDB on web, FileSystem on native)
 */
async function storeThumbnail(
  thumbnailFilename: string,
  base64Data: string
): Promise<string> {
  if (Platform.OS === 'web') {
    // Store in IndexedDB
    const db = await getIndexedDB();
    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    
    const thumbnailUri = `/thumbnails/${thumbnailFilename}`;
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        uri: thumbnailUri,
        data: base64Data,
        encoding: EncodingType.Base64,
        timestamp: Date.now(),
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return thumbnailUri;
  } else {
    // Store in FileSystem
    const documentDir = FileSystem.documentDirectory;
    if (!documentDir) {
      throw new Error('Document directory is not available');
    }
    
    const thumbnailDir = `${documentDir}thumbnails/`;
    const dirInfo = await FileSystem.getInfoAsync(thumbnailDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(thumbnailDir, { intermediates: true });
    }
    
    const thumbnailUri = `${thumbnailDir}${thumbnailFilename}`;
    await FileSystem.writeAsStringAsync(thumbnailUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return thumbnailUri;
  }
}

/**
 * Get thumbnail URI if it exists, or null
 */
export async function getThumbnailUri(filename: string): Promise<string | null> {
  // Ensure filename has an extension, default to .jpg if missing
  let normalizedFilename = filename;
  if (!filename.includes('.')) {
    // If no extension, assume it's a UUID or base name, add .jpg extension
    normalizedFilename = `${filename}.jpg`;
  }
  
  const extension = normalizedFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const baseName = normalizedFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  const thumbnailFilename = `${baseName}_thumb.${extension}`;

  if (Platform.OS === 'web') {
    try {
      const db = await getIndexedDB();
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const thumbnailUri = `/thumbnails/${thumbnailFilename}`;
      
      const fileData = await new Promise<any>((resolve, reject) => {
        const request = store.get(thumbnailUri);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (fileData && fileData.data) {
        // Convert to data URI for display
        const extension = thumbnailFilename.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (extension === 'png') {
          mimeType = 'image/png';
        } else if (extension === 'gif') {
          mimeType = 'image/gif';
        } else if (extension === 'webp') {
          mimeType = 'image/webp';
        }
        
        return `data:${mimeType};base64,${fileData.data}`;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  } else {
    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        return null;
      }
      
      const thumbnailUri = `${documentDir}thumbnails/${thumbnailFilename}`;
      const fileInfo = await FileSystem.getInfoAsync(thumbnailUri);
      
      if (fileInfo.exists) {
        return thumbnailUri;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Delete thumbnail for a given filename
 */
export async function deleteThumbnail(filename: string): Promise<void> {
  // Ensure filename has an extension, default to .jpg if missing
  let normalizedFilename = filename;
  if (!filename.includes('.')) {
    // If no extension, assume it's a UUID or base name, add .jpg extension
    normalizedFilename = `${filename}.jpg`;
  }
  
  const extension = normalizedFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const baseName = normalizedFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  const thumbnailFilename = `${baseName}_thumb.${extension}`;

  if (Platform.OS === 'web') {
    try {
      const db = await getIndexedDB();
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const thumbnailUri = `/thumbnails/${thumbnailFilename}`;
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(thumbnailUri);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      // Ignore errors
    }
  } else {
    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) {
        return;
      }
      
      const thumbnailUri = `${documentDir}thumbnails/${thumbnailFilename}`;
      await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URI prefix if present
        const base64 = reader.result.includes(',')
          ? reader.result.split(',')[1]
          : reader.result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

