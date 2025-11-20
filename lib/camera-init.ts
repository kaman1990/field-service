/**
 * Pre-initialize camera permissions to ensure camera works offline
 * This should be called early in the app lifecycle (e.g., on app start)
 * to initialize the camera module while online, so it works offline later
 */
import { getCameraPermissionsAsync } from 'expo-camera';

let initialized = false;

export async function initializeCamera(): Promise<void> {
  // Only initialize once
  if (initialized) {
    return;
  }

  try {
    // Pre-initialize camera permissions check
    // This ensures the camera module is initialized early
    await getCameraPermissionsAsync();
    initialized = true;
    console.log('[Camera] Camera module initialized successfully');
  } catch (error) {
    // Silently fail - this is just a pre-initialization attempt
    // The camera will still work, it just might need to initialize on first use
    console.log('[Camera] Pre-initialization failed (non-critical):', error);
    // Don't mark as initialized so we can retry later
  }
}

/**
 * Check if camera has been initialized
 */
export function isCameraInitialized(): boolean {
  return initialized;
}

