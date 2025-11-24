import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ScrollView, TouchableOpacity, Text, Alert, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Image as ImageType } from '../types/database';
import { ImageViewer } from './ImageViewer';
import { imageService } from '../services/images';
import { isNetworkError } from '../lib/error-utils';

interface ImageGalleryProps {
  images: ImageType[];
  onImagePress?: (image: ImageType) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onImagePress }) => {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageUris, setImageUris] = useState<Record<string, string>>({});
  const [fullImageUris, setFullImageUris] = useState<Record<string, string>>({});
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [contextMenuImageId, setContextMenuImageId] = useState<string | null>(null);

  // Load image URIs asynchronously
  useEffect(() => {
    const loadUris = async () => {
      const uriMap: Record<string, string> = {};
      
      // First, set URIs that are already available (image_url)
      // But for images with image_id, we'll try to get local file first
      images.forEach((image) => {
        // For images with image_id, we'll handle them in the async section below
        // to check for local files first
        if (!image.image_id && image.image_url) {
          uriMap[image.id] = image.image_url;
        }
      });
      
      // Then, for images with image_id, try to get thumbnail from attachment system
      await Promise.all(
        images.map(async (image) => {
          // Skip if we already have a URI
          if (uriMap[image.id]) {
            return;
          }
          
          // If image_id exists, try to get thumbnail from attachment system
          if (image.image_id) {
            try {
              // Use thumbnail for gallery display (150x150)
              const uri = await imageService.getThumbnailUri(image);
              if (uri) {
                uriMap[image.id] = uri;
              }
            } catch (error) {
              // Network errors are expected when offline - images will load when back online
              // Fallback to image_url if available
              if (image.image_url) {
                uriMap[image.id] = image.image_url;
              }
            }
          } else {
            // No image_id, use image_url directly
            if (image.image_url) {
              uriMap[image.id] = image.image_url;
            }
          }
        })
      );
      
      setImageUris(uriMap);
      
      // Load full-resolution URIs for ImageViewer
      const fullUriMap: Record<string, string> = {};
      await Promise.all(
        images.map(async (image) => {
          if (image.image_id) {
            try {
              // Get full-resolution image for viewer
              const uri = await imageService.getImageUri(image, false);
              if (uri) {
                fullUriMap[image.id] = uri;
              }
            } catch (error) {
              // Fallback to image_url if available
              if (image.image_url) {
                fullUriMap[image.id] = image.image_url;
              }
            }
          } else if (image.image_url) {
            fullUriMap[image.id] = image.image_url;
          }
        })
      );
      setFullImageUris(fullUriMap);
    };

    if (images.length > 0) {
      loadUris();
    }
  }, [images]);

  const handleImagePress = (image: ImageType, index: number) => {
    if (onImagePress) {
      onImagePress(image);
    } else {
      setSelectedIndex(index);
      setViewerVisible(true);
    }
  };

  const confirmDeleteImage = async (image: ImageType) => {
    setDeletingImageId(image.id);
    try {
      await imageService.deleteImage(image.id);
      setImageUris((prev) => {
        if (!prev[image.id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[image.id];
        return next;
      });
    } catch (error: any) {
      const message = isNetworkError(error)
        ? 'Unable to delete while offline. Please try again when you are back online.'
        : error?.message || 'Failed to delete image. Please try again.';
      Alert.alert('Delete failed', message);
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleImageLongPress = (image: ImageType) => {
    if (deletingImageId) {
      return;
    }
    setContextMenuImageId(image.id);
  };

  const handleDeleteImage = () => {
    const image = images.find(img => img.id === contextMenuImageId);
    if (image) {
      setContextMenuImageId(null);
      confirmDeleteImage(image);
    }
  };

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No images available</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
        {images.map((image, index) => (
          <TouchableOpacity
            key={image.id}
            style={styles.imageContainer}
            onPress={() => handleImagePress(image, index)}
            activeOpacity={0.8}
            disabled={deletingImageId === image.id}
            onLongPress={() => handleImageLongPress(image)}
            delayLongPress={600}
          >
            {(() => {
              // Use imageUris first (from async load), then fallback to direct image properties
              const uri = imageUris[image.id] || image.image_url;
              
              // Don't render image if URI is empty to avoid warning
              if (!uri) {
                return (
                  <View style={[styles.image, styles.placeholder]}>
                    <Text style={styles.placeholderText}>Loading...</Text>
                  </View>
                );
              }
              
              return (
                <>
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="cover"
                    onError={(error) => {
                      const errorMessage = error.nativeEvent?.error?.message || error.nativeEvent?.error?.toString() || '';
                      // Network errors are expected when offline - images will load when back online
                    }}
                  />
                  {deletingImageId === image.id && (
                    <View style={styles.deletingOverlay}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.deletingText}>Removing…</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ImageViewer
        images={images}
        imageUris={fullImageUris}
        initialIndex={selectedIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />

      {/* Context Menu Modal */}
      <Modal
        visible={!!contextMenuImageId}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenuImageId(null)}
      >
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuImageId(null)}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuItemDestructive]}
              onPress={handleDeleteImage}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.contextMenuText, styles.contextMenuTextDestructive]}>Remove Image</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuCancel]}
              onPress={() => setContextMenuImageId(null)}
            >
              <Text style={styles.contextMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  imageContainer: {
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: 150,
    height: 150,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 13,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  contextMenuItemDestructive: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  contextMenuText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  contextMenuTextDestructive: {
    color: '#FF3B30',
  },
  contextMenuCancel: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 4,
  },
  contextMenuCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
});

