import { getPowerSync, getInitializedPowerSync } from '../lib/powersync';
import type { Image } from '../types/database';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getAttachmentQueue } from '../lib/attachment-queue-init';
import { isNetworkError } from '../lib/error-utils';
import { AttachmentState } from '@powersync/attachments';
import { generateThumbnail, getThumbnailUri, deleteThumbnail } from '../lib/image-thumbnail';

const powerSync = getPowerSync();

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


export const imageService = {
  async getImages(entityType: 'asset' | 'point' | 'gateway', entityId: string): Promise<Image[]> {
    const columnMap = {
      asset: 'asset_id',
      point: 'point_id',
      gateway: 'gateway_id',
    };
    
    return await powerSync.getAll<Image>(
      `SELECT * FROM images WHERE ${columnMap[entityType]} = ? AND enabled = ? ORDER BY created_at DESC`,
      [entityId, true]
    );
  },

  async pickImage(): Promise<ImagePicker.ImagePickerResult> {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      throw new Error('Permission to access camera roll is required!');
    }
    
    return await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
  },

  async captureImage(): Promise<ImagePicker.ImagePickerResult> {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      throw new Error('Permission to access camera is required!');
    }
    
    return await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
  },

  async captureMultipleImages(
    onImageCaptured: (uri: string) => Promise<void>
  ): Promise<void> {
    const takeAnotherPhoto = async (): Promise<void> => {
      try {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Permission to access camera is required!');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
          await onImageCaptured(result.assets[0].uri);
          
          // Ask if they want to take another photo
          Alert.alert(
            'Photo Added',
            'Would you like to take another photo?',
            [
              {
                text: 'Take Another',
                onPress: takeAnotherPhoto,
              },
              {
                text: 'Done',
                style: 'cancel',
              },
            ]
          );
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
    };

    await takeAnotherPhoto();
  },

  async pickImageWithChoice(): Promise<ImagePicker.ImagePickerResult | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'Select Photo',
        'Choose an option',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
                if (cameraPermission.granted === false) {
                  Alert.alert('Permission Required', 'Permission to access camera is required!');
                  resolve({ canceled: true, assets: null });
                  return;
                }
                const result = await ImagePicker.launchCameraAsync({
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                resolve(result);
              } catch (error) {
                resolve({ canceled: true, assets: null });
              }
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              try {
                const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (galleryPermission.granted === false) {
                  Alert.alert('Permission Required', 'Permission to access camera roll is required!');
                  resolve({ canceled: true, assets: null });
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                resolve(result);
              } catch (error) {
                resolve({ canceled: true, assets: null });
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ canceled: true, assets: null }),
          },
        ],
        { cancelable: true, onDismiss: () => resolve({ canceled: true, assets: null }) }
      );
    });
  },

  async uploadImage(
    uri: string,
    entityType: 'asset' | 'point' | 'gateway',
    entityId: string,
    siteId?: string
  ): Promise<Image> {
    try {
      const powerSync = await getInitializedPowerSync();
      const attachmentQueue = getAttachmentQueue();
      
      if (!attachmentQueue) {
        throw new Error('AttachmentQueue is not available. Please ensure PowerSync is connected.');
      }

      // Check if URI is a data URI (data:image/png;base64,...)
      const isDataUri = uri.startsWith('data:');
      let base64Data: string;
      let finalUri = uri;
      let extension = 'jpg'; // Default

      if (isDataUri) {
        // Extract base64 data from data URI
        // Format: data:image/png;base64,iVBORw0KGgo...
        const commaIndex = uri.indexOf(',');
        if (commaIndex === -1) {
          throw new Error('Invalid data URI format');
        }
        
        const mimePart = uri.substring(5, commaIndex); // Remove "data:" prefix
        const base64Part = uri.substring(commaIndex + 1);
        
        // Extract MIME type and determine extension
        if (mimePart.includes('image/png')) {
          extension = 'png';
        } else if (mimePart.includes('image/gif')) {
          extension = 'gif';
        } else if (mimePart.includes('image/webp')) {
          extension = 'webp';
        } else {
          extension = 'jpg'; // Default to jpg for jpeg
        }
        
        base64Data = base64Part;
      } else {
        // Handle file URI - only on native platforms
        if (Platform.OS === 'web') {
          throw new Error('File URIs are not supported on web platform. Please use data URIs instead.');
        }

        // Normalize URI - ensure it's a proper file:// URI
        // Camera URIs might not always be in the correct format, especially when offline
        let normalizedUri = uri;
        if (!normalizedUri.startsWith('file://') && !normalizedUri.startsWith('http://') && !normalizedUri.startsWith('https://')) {
          // If it's a relative path, prepend file://
          normalizedUri = normalizedUri.startsWith('/') ? `file://${normalizedUri}` : `file:///${normalizedUri}`;
        }

        // Verify the file exists and is accessible
        let fileInfo;
        try {
          fileInfo = await FileSystem.getInfoAsync(normalizedUri);
        } catch (infoError: any) {
          // If normalized URI fails, try original URI
          try {
            fileInfo = await FileSystem.getInfoAsync(uri);
            normalizedUri = uri;
          } catch {
            throw new Error(`Cannot access image file at URI: ${uri}. Error: ${infoError?.message || infoError}`);
          }
        }

        if (!fileInfo || !fileInfo.exists) {
          throw new Error(`Image file does not exist at URI: ${normalizedUri}`);
        }

        // If the URI is a temporary file or in cache, copy it to a permanent location
        // Camera photos on some platforms may be in temporary locations that get cleaned up
        const needsCopy = normalizedUri.includes('cache') || 
                         normalizedUri.includes('temp') || 
                         normalizedUri.includes('ImagePicker') ||
                         normalizedUri.includes('Camera');
        
        if (needsCopy) {
          try {
            // Copy to a permanent location in the document directory
            const timestamp = Date.now();
            const tempFileName = `image_${timestamp}.jpg`;
            const documentDir = FileSystem.documentDirectory;
            if (!documentDir) {
              throw new Error('Document directory is not available');
            }
            const permanentUri = `${documentDir}${tempFileName}`;
            await FileSystem.copyAsync({
              from: normalizedUri,
              to: permanentUri,
            });
            // Verify the copy was successful
            const copiedInfo = await FileSystem.getInfoAsync(permanentUri);
            if (!copiedInfo || !copiedInfo.exists) {
              throw new Error('Failed to copy image file to permanent location');
            }
            finalUri = permanentUri;
          } catch (copyError: any) {
            // Continue with original URI if copy fails
            finalUri = normalizedUri;
          }
        } else {
          finalUri = normalizedUri;
        }

        // Read the image file as base64
        try {
          base64Data = await FileSystem.readAsStringAsync(finalUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (readError: any) {
          const errorMessage = readError?.message || readError?.toString() || '';
          // If we get a "bundle" error, it might be a file access issue
          if (errorMessage.includes('bundle') || errorMessage.includes('Could not load')) {
            throw new Error(`Failed to read image file. The file may be inaccessible or corrupted. Original error: ${errorMessage}`);
          }
          throw readError;
        }
      }

      // FileInfo doesn't have size property, we'll calculate from base64 data
      const fileSize = Math.floor(base64Data.length * 0.75); // Approximate size from base64
      
      // Determine file extension if not already set from data URI
      if (!isDataUri) {
        // Method 1: Try to get from URI path (before query params)
        const uriPath = finalUri.split('?')[0]; // Remove query parameters
        const uriExtension = uriPath.split('.').pop()?.toLowerCase();
        if (uriExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(uriExtension)) {
          extension = uriExtension === 'jpeg' ? 'jpg' : uriExtension;
        } else {
          // Method 2: Detect from base64 data signature
          // PNG signature starts with: iVBORw0KGgo (base64 of PNG header)
          // JPEG signature starts with: /9j/ (base64 of JPEG header FF D8 FF)
          const base64Start = base64Data.substring(0, 20);
          if (base64Start.startsWith('iVBORw0KGgo')) {
            extension = 'png';
          } else if (base64Start.startsWith('/9j/')) {
            extension = 'jpg';
          }
        }
      }
      
      const mediaType = extension === 'png' ? 'image/png' : 
                       extension === 'gif' ? 'image/gif' :
                       extension === 'webp' ? 'image/webp' : 'image/jpeg';

      // Generate a unique attachment ID
      const attachmentId = generateUUID();
      const filename = `${attachmentId}.${extension}`;

      const storageAdapter = (attachmentQueue as any).storage;
      const { EncodingType } = await import('@powersync/attachments');

      // Get local file path suffix for the attachment
      const localFilePathSuffix = attachmentQueue.getLocalFilePathSuffix(filename);
      const localUri = attachmentQueue.getLocalUri(localFilePathSuffix);

      // Write file to local storage (uses IndexedDB on web, FileSystem on native)
      // This preserves offline capability - files are stored locally and queued for upload
      await storageAdapter.writeFile(localUri, base64Data, {
        encoding: EncodingType.Base64,
      });

      // Create attachment record and save to queue
      // PowerSync's attachment queue will automatically handle uploads
      const attachmentRecord = await attachmentQueue.newAttachmentRecord({
        id: attachmentId,
        filename,
        media_type: mediaType,
        size: fileSize,
        local_uri: localFilePathSuffix,
        state: AttachmentState.QUEUED_UPLOAD,
      });

      await attachmentQueue.saveToQueue(attachmentRecord);

      // Construct Supabase Storage URL
      const { supabase } = require('../lib/supabase');
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filename);
      const imageUrl = urlData?.publicUrl || `https://xlqljnrvgvsznjbulucw.supabase.co/storage/v1/object/public/images/${filename}`;

      // Create image record in images table
      const now = new Date().toISOString();
      const imageId = generateUUID();
      
      const columnMap = {
        asset: 'asset_id',
        point: 'point_id',
        gateway: 'gateway_id',
      };

      // Store the storage path in image_id (full path including resized/ prefix if applicable)
      // For now, storing just the filename; can be updated to include full path (e.g., "resized/filename_w250") if resized version exists
      await powerSync.execute(
        `INSERT INTO images (id, image_id, image_url, ${columnMap[entityType]}, site_id, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [imageId, filename, imageUrl, entityId, siteId || null, 1, now, now]
      );

      // Fetch and return the created image record
      const image = await powerSync.get<Image>(
        'SELECT * FROM images WHERE id = ?',
        [imageId]
      );

      if (!image) {
        throw new Error('Failed to retrieve created image record');
      }

      return image;
    } catch (error: any) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  },

  async deleteImage(id: string): Promise<void> {
    // Get image record to find filename for thumbnail cleanup
    const image = await powerSync.get<Image>(
      'SELECT * FROM images WHERE id = ?',
      [id]
    );
    
    // Delete thumbnail if image_id exists
    if (image?.image_id) {
      let filename = image.image_id;
      // Extract filename (remove path prefix and suffix if present)
      if (filename.includes('/')) {
        filename = filename.split('/').pop() || filename;
      }
      if (filename.includes('_w250')) {
        filename = filename.replace('_w250', '');
      }
      // Ensure filename has an extension (default to .jpg if missing)
      if (!filename.includes('.')) {
        filename = `${filename}.jpg`;
      }
      await deleteThumbnail(filename);
    }
    
    await powerSync.execute(
      'UPDATE images SET enabled = ? WHERE id = ?',
      [false, id]
    );
  },

  /**
   * Get the thumbnail URI for display (150x150)
   * Checks for existing thumbnail, generates one if needed, falls back to full image
   */
  async getThumbnailUri(image: Image): Promise<string> {
    // For images without image_id, use image_url directly (old images)
    if (!image.image_id) {
      if (image.image_url) {
        return image.image_url;
      }
      return '';
    }
    
    // Extract filename
    const storagePath = image.image_id;
    let filename = storagePath;
    if (storagePath.includes('/')) {
      filename = storagePath.split('/').pop() || storagePath;
    }
    if (filename.includes('_w250')) {
      filename = filename.replace('_w250', '');
    }
    
    // Ensure filename has an extension (default to .jpg if missing)
    // This prevents Metro from trying to process UUIDs as asset paths
    if (!filename.includes('.')) {
      filename = `${filename}.jpg`;
    }
    
    // Check if thumbnail exists
    const existingThumbnail = await getThumbnailUri(filename);
    if (existingThumbnail) {
      return existingThumbnail;
    }
    
    // Thumbnail doesn't exist, try to generate it
    // First, get the full image URI
    const fullImageUri = await this.getImageUri(image, false);
    if (!fullImageUri) {
      return '';
    }
    
    // Generate thumbnail from full image
    const thumbnailUri = await generateThumbnail(fullImageUri, filename);
    if (thumbnailUri) {
      return thumbnailUri;
    }
    
    // If thumbnail generation fails, fall back to full image
    return fullImageUri;
  },

  /**
   * Get the image URI for display
   * image_id now contains the filename (with extension), so we can use it directly
   * For old images without image_id, falls back to image_url
   * @param useThumbnail - If true, returns thumbnail URI (default: false for full resolution)
   */
  async getImageUri(image: Image, useThumbnail: boolean = false): Promise<string> {
    // If thumbnail is requested, use getThumbnailUri
    if (useThumbnail) {
      return this.getThumbnailUri(image);
    }
    // For images without image_id, use image_url directly (old images)
    if (!image.image_id) {
      if (image.image_url) {
        return image.image_url;
      }
      return '';
    }
    
    // image_id contains the full storage path (e.g., "resized/filename_w250" or "filename")
    const storagePath = image.image_id;
    
    // Extract filename for attachment lookup (remove path prefix and suffix if present)
    // e.g., "resized/abc123.jpg_w250" -> "abc123.jpg"
    let filename = storagePath;
    if (storagePath.includes('/')) {
      filename = storagePath.split('/').pop() || storagePath;
    }
    // Remove _w250 suffix if present
    if (filename.includes('_w250')) {
      filename = filename.replace('_w250', '');
    }
    
    // Ensure filename has an extension (default to .jpg if missing)
    // This prevents Metro from trying to process UUIDs as asset paths
    if (!filename.includes('.')) {
      filename = `${filename}.jpg`;
    }
    
    // Try local file first (for newly uploaded images that haven't synced yet)
    const attachmentQueue = getAttachmentQueue();
    if (attachmentQueue) {
      try {
        // Find attachment record by filename to check for local file
        const powerSync = await getInitializedPowerSync();
        const attachmentRecord = await powerSync.get<{
          local_uri?: string;
        }>(
          'SELECT local_uri FROM attachments WHERE filename = ?',
          [filename]
        );
        
        if (attachmentRecord?.local_uri) {
          const localUri = attachmentQueue.getLocalUri(attachmentRecord.local_uri);
          const storageAdapter = (attachmentQueue as any).storage;
          if (storageAdapter) {
            const exists = await storageAdapter.fileExists(localUri);
            if (exists) {
              // On web, we need to convert IndexedDB-stored files to data URIs for display
              if (Platform.OS === 'web') {
                try {
                  // Read base64 data directly from IndexedDB
                  const { getIndexedDB } = await import('../lib/storage-adapter');
                  const db = await getIndexedDB();
                  
                  const transaction = db.transaction(['files'], 'readonly');
                  const store = transaction.objectStore('files');
                  
                  const fileData = await new Promise<any>((resolve, reject) => {
                    const request = store.get(localUri);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                  });
                  
                  if (!fileData || !fileData.data) {
                    throw new Error('File data not found in IndexedDB');
                  }
                  
                  const base64Data = fileData.data;
                  
                  // Determine MIME type from filename extension
                  const extension = filename.split('.').pop()?.toLowerCase();
                  let mimeType = 'image/jpeg'; // default
                  if (extension === 'png') {
                    mimeType = 'image/png';
                  } else if (extension === 'gif') {
                    mimeType = 'image/gif';
                  } else if (extension === 'webp') {
                    mimeType = 'image/webp';
                  }
                  
                  // Return data URI
                  const dataUri = `data:${mimeType};base64,${base64Data}`;
                  return dataUri;
                } catch (error: any) {
                  // Fall through to use cloud URL
                }
              } else {
                // Native platforms can use file URIs directly
                return localUri;
              }
            }
          }
        }
      } catch (error) {
        // Continue to use public URL if local file check fails
      }
    }
    
    // Use image_id directly as the storage path (no path construction needed)
    const { supabase } = require('../lib/supabase');
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(storagePath);
    if (urlData?.publicUrl) {
      return urlData.publicUrl;
    }
    
    // Fallback to image_url if available
    if (image.image_url) {
      return image.image_url;
    }
    
    // Last resort - return empty string (will show placeholder)
    return '';
  },
};



