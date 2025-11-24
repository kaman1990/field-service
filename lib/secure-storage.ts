import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Conditionally import EncryptedStorage only on native platforms
let EncryptedStorage: any = null;
if (Platform.OS !== 'web') {
  try {
    EncryptedStorage = require('react-native-encrypted-storage').default;
  } catch (error) {
    console.warn('EncryptedStorage not available, falling back to AsyncStorage');
  }
}

/**
 * Secure storage adapter that uses EncryptedStorage for sensitive data
 * Falls back to AsyncStorage on web (where EncryptedStorage is not available)
 */
class SecureStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web' || !EncryptedStorage) {
        // On web or if EncryptedStorage is not available, use AsyncStorage
        return await AsyncStorage.getItem(key);
      }
      return await EncryptedStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      // Fallback to AsyncStorage on error
      try {
        return await AsyncStorage.getItem(key);
      } catch (fallbackError) {
        return null;
      }
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || !EncryptedStorage) {
        // On web or if EncryptedStorage is not available, use AsyncStorage
        await AsyncStorage.setItem(key, value);
        return;
      }
      await EncryptedStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
      // Fallback to AsyncStorage on error
      await AsyncStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || !EncryptedStorage) {
        await AsyncStorage.removeItem(key);
        return;
      }
      await EncryptedStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
      // Fallback to AsyncStorage on error
      await AsyncStorage.removeItem(key);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      // Always use AsyncStorage for getAllKeys as EncryptedStorage doesn't support it
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web' || !EncryptedStorage) {
        await AsyncStorage.clear();
        return;
      }
      // EncryptedStorage doesn't have clear, so we need to remove items individually
      // For now, we'll use AsyncStorage clear as a fallback
      // In production, track keys and remove them individually
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
}

export const secureStorage = new SecureStorageAdapter();

