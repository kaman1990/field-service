import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
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

  // Load image URIs asynchronously
  useEffect(() => {
    const loadUris = async () => {
      const uriMap: Record<string, string> = {};
      
      // First, set URIs that are already available (image_url, resized_image_url)
      // But for images with image_id, we'll try to get local file first
      images.forEach((image) => {
        // For images with image_id, we'll handle them in the async section below
        // to check for local files first
        if (!image.image_id) {
          if (image.image_url) {
            uriMap[image.id] = image.image_url;
          } else if (image.resized_image_url) {
            uriMap[image.id] = image.resized_image_url;
          }
        }
      });
      
      // Then, for images with image_id, try to get from attachment system
      await Promise.all(
        images.map(async (image) => {
          // Skip if we already have a URI
          if (uriMap[image.id]) {
            return;
          }
          
          // If image_id exists, try to get from attachment system
          if (image.image_id) {
            try {
              const uri = await imageService.getImageUri(image);
              if (uri) {
                uriMap[image.id] = uri;
                console.log(`[ImageGallery] Loaded URI for image ${image.id}: ${uri.substring(0, 50)}...`);
              } else {
                console.warn(`[ImageGallery] No URI returned for image ${image.id}`);
              }
            } catch (error) {
              // Only log error if it's not a network/offline error
              // Network errors are expected when offline - images will load when back online
              if (isNetworkError(error)) {
                console.debug(`[ImageGallery] Failed to load URI for image ${image.id} (network/offline - will retry when online):`, error);
              } else {
                console.error(`[ImageGallery] Failed to load URI for image ${image.id}:`, error);
              }
              // Fallback to image_url if available
              if (image.image_url) {
                uriMap[image.id] = image.image_url;
              }
            }
          } else {
            // No image_id, use image_url directly
            if (image.image_url) {
              uriMap[image.id] = image.image_url;
            } else if (image.resized_image_url) {
              uriMap[image.id] = image.resized_image_url;
            }
          }
        })
      );
      
      console.log(`[ImageGallery] Loaded URIs for ${Object.keys(uriMap).length} images`);
      
      setImageUris(uriMap);
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
          >
            {(() => {
              // Use imageUris first (from async load), then fallback to direct image properties
              const uri = imageUris[image.id] || image.image_url || image.resized_image_url;
              
              // Don't render image if URI is empty to avoid warning
              if (!uri) {
                return (
                  <View style={[styles.image, styles.placeholder]}>
                    <Text style={styles.placeholderText}>Loading...</Text>
                  </View>
                );
              }
              
              return (
                <Image
                  source={{ uri }}
                  style={styles.image}
                  resizeMode="cover"
                  onError={(error) => {
                    const errorMessage = error.nativeEvent?.error?.message || error.nativeEvent?.error?.toString() || '';
                    const errorObj = { message: errorMessage };
                    // Only log error if it's not a network/offline error
                    // Network errors are expected when offline - images will load when back online
                    if (isNetworkError(errorObj)) {
                      console.debug(`[ImageGallery] Failed to load image ${image.id} (network/offline - will retry when online)`);
                    } else {
                      console.error(`[ImageGallery] Failed to load image ${image.id}:`, error.nativeEvent.error);
                    }
                  }}
                />
              );
            })()}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ImageViewer
        images={images}
        imageUris={imageUris}
        initialIndex={selectedIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
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
});

