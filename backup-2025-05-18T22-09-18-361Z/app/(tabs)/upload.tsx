import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator, ScrollView, Modal, Alert, Platform } from 'react-native';
import { Camera, Upload, Search, X } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  image_url: string;
  price: number;
}

export default function UploadScreen() {
  const { imageUri } = useLocalSearchParams();
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Redirect back to tabs if no image URI is provided
  useEffect(() => {
    if (!imageUri) {
      router.back();
    }
  }, [imageUri]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url, price')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      setShowProductModal(true);
    } catch (err) {
      console.error('Error loading products:', err);
      Alert.alert('Error', 'Failed to load products. Please try again.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLinkProduct = (productId: string) => {
    setSelectedProductId(productId);
    setShowProductModal(false);
  };

  const uploadImage = async (uri: string, userId: string): Promise<string> => {
    try {
      setUploadingImage(true);
      // Upload image to Supabase Storage
      const fileName = `${userId}/${Date.now()}.jpg`;
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
      } else {
        // For native platforms (iOS/Android)
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, formData, {
            contentType: 'multipart/form-data',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error('Image upload error:', err);
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) {
      setError('No image selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to upload posts');
        return;
      }

      let publicUrl;
      try {
        publicUrl = await uploadImage(imageUri as string, user.id);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('Bucket not found')) {
            setError('Storage is not properly configured. Please contact support.');
          } else if (err.message.includes('Permission denied')) {
            setError('You do not have permission to upload files.');
          } else if (err.message.includes('Entity too large')) {
            setError('File is too large. Please choose a smaller file.');
          } else {
            setError(`Upload failed: ${err.message}`);
          }
        } else {
          setError('Failed to upload image. Please try again.');
        }
        return;
      }

      // Create post in database
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          caption: caption.trim() || null,
          product_id: selectedProductId,
        });

      if (postError) {
        if (postError.message.includes('duplicate key')) {
          setError('You have already created this post.');
        } else if (postError.message.includes('foreign key')) {
          setError('Your profile needs to be set up before posting.');
        } else {
          setError('Failed to create post. Please try again.');
        }
        return;
      }

      // Reset form and navigate to home
      setCaption('');
      setSelectedProductId(null);
      
      // Show success message
      Alert.alert('Success', 'Your post has been uploaded!', [
        { text: 'OK', onPress: () => router.push('/(tabs)') }
      ]);
    } catch (err) {
      console.error('Post upload error:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (!imageUri) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Post</Text>
        <TouchableOpacity 
          style={[styles.linkButton, loadingProducts && styles.buttonDisabled]}
          onPress={loadProducts}
          disabled={loadingProducts}>
          {loadingProducts ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.linkButtonText}>
              {selectedProductId ? 'Change Product' : 'Link to Product'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        <View style={styles.imageContainer}>
          {uploadingImage ? (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : null}
          <Image source={{ uri: imageUri as string }} style={styles.preview} />
        </View>
        
        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption..."
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={2200}
        />

        {selectedProductId && (
          <View style={styles.selectedProduct}>
            <Text style={styles.selectedProductText}>
              Product linked: {products.find(p => p.id === selectedProductId)?.name}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.uploadButton, (loading || uploadingImage) && styles.buttonDisabled]}
          onPress={handleUpload}
          disabled={loading || uploadingImage}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>Share Post</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Products</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowProductModal(false)}>
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products uploaded yet</Text>
                <Text style={styles.emptySubtext}>
                  Add products in the marketplace tab to link them to your posts
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.productList}>
                <View style={styles.productGrid}>
                  {products.map((product) => (
                    <View key={product.id} style={styles.productCard}>
                      <Image
                        source={{ uri: product.image_url }}
                        style={styles.productImage}
                      />
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text style={styles.productPrice}>
                          ${product.price.toFixed(2)}
                        </Text>
                        <TouchableOpacity 
                          style={[
                            styles.linkProductButton,
                            selectedProductId === product.id && styles.linkedProductButton
                          ]}
                          onPress={() => handleLinkProduct(product.id)}>
                          <Text style={styles.linkProductButtonText}>
                            {selectedProductId === product.id ? 'Linked' : 'Link'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 10,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  selectedProduct: {
    backgroundColor: '#F0F0FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  selectedProductText: {
    color: '#6C5CE7',
    fontSize: 14,
    fontWeight: '500',
  },
  linkButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#6C5CE7',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  error: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  productList: {
    padding: 10,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  productImage: {
    width: '100%',
    height: 150,
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
    marginBottom: 8,
  },
  linkProductButton: {
    backgroundColor: '#6C5CE7',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  linkedProductButton: {
    backgroundColor: '#4CAF50',
  },
  linkProductButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});