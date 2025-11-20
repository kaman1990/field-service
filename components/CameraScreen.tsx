import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, Image, ScrollView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode, getCameraPermissionsAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

interface CameraScreenProps {
  onPhotosTaken: (uris: string[]) => void;
  onClose: () => void;
  maxPhotos?: number;
}

export const CameraScreen: React.FC<CameraScreenProps> = ({ 
  onPhotosTaken, 
  onClose,
  maxPhotos = 10 
}) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Ensure camera module is initialized when component mounts
  useEffect(() => {
    const initCamera = async () => {
      try {
        // Pre-initialize camera permissions to ensure module is ready
        await getCameraPermissionsAsync();
        setCameraReady(true);
      } catch (error) {
        // If initialization fails, still allow camera to work
        // It will initialize on first use if needed
        console.log('[CameraScreen] Pre-initialization failed, will initialize on use:', error);
        setCameraReady(true); // Still allow camera to be used
      }
    };

    initCamera();
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      // Ensure camera is ready before taking picture
      if (!cameraRef.current) {
        throw new Error('Camera not ready');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedPhotos([...capturedPhotos, photo.uri]);
      }
    } catch (error: any) {
      console.error('Error taking picture:', error);
      
      // Check if it's a network/initialization error
      const errorMessage = error?.message || error?.toString() || '';
      const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                            errorMessage.toLowerCase().includes('fetch') ||
                            errorMessage.toLowerCase().includes('offline');
      
      if (isNetworkError) {
        Alert.alert(
          'Camera Initialization Error', 
          'The camera needs to be initialized while online. Please connect to the internet and try again, or restart the app while online.'
        );
      } else {
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const handleDone = () => {
    if (capturedPhotos.length > 0) {
      onPhotosTaken(capturedPhotos);
    }
    onClose();
  };

  const removeLastPhoto = () => {
    if (capturedPhotos.length > 0) {
      setCapturedPhotos(capturedPhotos.slice(0, -1));
    }
  };

  const removePhoto = (index: number) => {
    setCapturedPhotos(capturedPhotos.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        onCameraReady={() => {
          // Camera is ready - mark as initialized
          setCameraReady(true);
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.photoCountContainer}>
            <Text style={styles.photoCount}>
              {capturedPhotos.length} {capturedPhotos.length === 1 ? 'photo' : 'photos'}
            </Text>
          </View>
          <View style={styles.flashContainer}>
            {flash === 'auto' && (
              <Text style={styles.flashAutoText}>auto</Text>
            )}
            <TouchableOpacity
              style={[styles.flashButton, flash !== 'off' && styles.flashButtonActive]}
              onPress={toggleFlash}
            >
              <Text style={styles.flashButtonText}>
                {flash === 'on' ? '⚡' : flash === 'auto' ? '⚡️' : '⚡'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.placeholder} />

          <TouchableOpacity
            style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={isProcessing || capturedPhotos.length >= maxPhotos}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.thumbnailContainer}>
            {capturedPhotos.length > 0 && (
              <TouchableOpacity 
                style={styles.thumbnailPreview}
                onPress={() => setGalleryVisible(true)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: capturedPhotos[capturedPhotos.length - 1] }}
                  style={styles.thumbnailImage}
                />
                <View style={styles.thumbnailBadge}>
                  <Text style={styles.thumbnailBadgeText}>{capturedPhotos.length}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {capturedPhotos.length > 0 && (
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done ({capturedPhotos.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={galleryVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Captured Photos ({capturedPhotos.length})</Text>
            <TouchableOpacity onPress={() => setGalleryVisible(false)}>
              <Text style={styles.galleryCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.galleryScrollView} contentContainerStyle={styles.galleryContent}>
            {capturedPhotos.map((uri, index) => (
              <View key={index} style={styles.galleryItem}>
                <Image source={{ uri }} style={styles.galleryImage} />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    removePhoto(index);
                    if (capturedPhotos.length === 1) {
                      setGalleryVisible(false);
                    }
                  }}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  photoCountContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 50,
    alignItems: 'center',
  },
  photoCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  flashContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(255, 255, 0, 0.7)',
  },
  flashButtonText: {
    fontSize: 20,
  },
  flashAutoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  thumbnailContainer: {
    width: 60,
    alignItems: 'center',
  },
  thumbnailPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  thumbnailBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 60,
  },
  doneButton: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  galleryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  galleryCloseButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryScrollView: {
    flex: 1,
  },
  galleryContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  galleryItem: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 10,
    marginRight: '2%',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

