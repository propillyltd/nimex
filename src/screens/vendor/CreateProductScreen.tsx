import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Save, Loader2, Upload, X, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { storage } from '../../lib/firebase.config';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { ProductTagsInput } from '../../components/vendor/ProductTagsInput';

interface Category {
  id: string;
  name: string;
}

const PREDEFINED_TAGS = [
  { id: 'trending', label: 'Trending' },
  { id: 'verified', label: 'Verified' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'new_arrival', label: 'New Arrival' },
  { id: 'limited_stock', label: 'Limited Stock' },
  { id: 'hot_deal', label: 'Hot Deal' },
];

export const CreateProductScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    stock_quantity: '',
    category_id: '',
    image_url: '',
    video_url: '',
    tags: [] as string[],
  });

  useEffect(() => {
    loadCategories();
    if (isEditing && id) {
      loadProductForEditing(id);
    }
  }, [isEditing, id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const loadProductForEditing = async (productId: string) => {
    try {
      setLoading(true);
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          product_tags (
            tag
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      if (product) {
        setFormData({
          name: product.title || product.name, // Handle potential schema difference
          description: product.description || '',
          price: product.price.toString(),
          compare_at_price: product.compare_at_price?.toString() || '',
          stock_quantity: product.stock_quantity.toString(),
          category_id: product.category_id || '',
          image_url: typeof product.images === 'string' ? product.images : (product.images as any)?.url || '', // Handle JSON or string
          video_url: product.video_url || '',
          tags: product.product_tags?.map((pt: any) => pt.tag) || [],
        });

        const img = typeof product.images === 'string' ? product.images : (product.images as any)?.url;
        if (img) setImagePreview(img);
      }
    } catch (err: any) {
      setError('Failed to load product for editing');
      console.error('Error loading product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUrlChange = (url: string) => {
    setFormData({ ...formData, image_url: url });
    setImagePreview(url);
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError('Video file size must be less than 50MB');
        return;
      }
      // Check file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      setVideoFile(file);
      // Clear any previous error
      setError('');
    }
  };

  const handleTagToggle = (tagId: string) => {
    setFormData(prev => {
      const newTags = prev.tags.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : [...prev.tags, tagId];
      return { ...prev, tags: newTags };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!user) throw new Error('User not authenticated');

      // Get vendor ID
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vendorError) throw vendorError;
      if (!vendor) throw new Error('Vendor profile not found');

      let finalVideoUrl = formData.video_url;

      if (videoFile) {
        setIsUploading(true);
        try {
          // Generate a storage path ID (use existing ID if editing, or random if new)
          const storageId = id || `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const fileExt = videoFile.name.split('.').pop();
          const fileName = `video_${Date.now()}.${fileExt}`;
          const storageRef = ref(storage, `products/${storageId}/${fileName}`);

          const uploadTask = uploadBytesResumable(storageRef, videoFile);

          await new Promise<void>((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
              },
              (error) => {
                reject(error);
              },
              async () => {
                finalVideoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve();
              }
            );
          });

          setIsUploading(false);
        } catch (err) {
          console.error('Video upload failed:', err);
          throw new Error('Failed to upload video. Please try again.');
        }
      }

      let product;

      const productData = {
        title: formData.name, // Schema uses title
        name: formData.name, // Keep for compatibility if schema is mixed
        description: formData.description || null,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        stock_quantity: parseInt(formData.stock_quantity),
        category_id: formData.category_id || null,
        images: formData.image_url, // Storing as string for now, or object if needed
        image_url: formData.image_url, // Keep for compatibility
        video_url: finalVideoUrl || null,
      };

      if (isEditing && id) {
        // Update existing product
        const { data: updatedProduct, error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;
        product = updatedProduct;
      } else {
        // Create new product
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            vendor_id: vendor.id,
            ...productData,
            status: 'active', // Schema uses status
            is_active: true, // Keep for compatibility
          })
          .select()
          .single();

        if (createError) throw createError;
        product = newProduct;
      }

      // Handle tags for both create and update
      if (product) {
        // Delete existing tags first
        await supabase
          .from('product_tags')
          .delete()
          .eq('product_id', product.id);

        // Add new tags if any
        if (formData.tags.length > 0) {
          const tagInserts = formData.tags.map((tag: string) => ({
            product_id: product.id,
            tag: tag,
          }));

          const { error: tagsError } = await supabase
            .from('product_tags')
            .insert(tagInserts);

          if (tagsError) throw tagsError;
        }
      }

      setSuccess(isEditing ? 'Product updated successfully!' : 'Product created successfully!');
      setTimeout(() => {
        navigate('/vendor/products');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const discountPercentage = formData.price && formData.compare_at_price
    ? Math.round(((parseFloat(formData.compare_at_price) - parseFloat(formData.price)) / parseFloat(formData.compare_at_price)) * 100)
    : 0;

  return (
    <div className="w-full min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-8">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/vendor/products')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-700" />
            </button>
            <div>
              <h1 className="font-heading font-bold text-lg md:text-3xl text-neutral-900">
                {isEditing ? 'Edit Product' : 'Create New Product'}
              </h1>
              <p className="font-sans text-xs md:text-sm text-neutral-600 mt-0.5 md:mt-1">
                Add a new product to your store
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="font-sans text-xs md:text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 md:p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-sans text-xs md:text-sm text-green-600">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <Card>
              <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-3 pb-3 md:pb-4 border-b border-neutral-100">
                  <h2 className="font-heading font-semibold text-sm md:text-xl text-neutral-900">
                    Product Information
                  </h2>
                </div>

                <div>
                  <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Handwoven Basket"
                  />
                </div>

                <div>
                  <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="Describe your product..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                      Selling Price (₦) *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                      Original Price (₦) <span className="text-neutral-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      value={formData.compare_at_price}
                      onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                      min="0"
                      step="0.01"
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    {discountPercentage > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        {discountPercentage}% off
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      required
                      min="0"
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                    Product Image URL
                  </label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => handleImageUrlChange(e.target.value)}
                      className="w-full h-10 md:h-12 px-3 md:px-4 rounded-lg border border-neutral-200 font-sans text-sm md:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    {imagePreview && (
                      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-lg overflow-hidden border border-neutral-200">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={() => setImagePreview(null)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, image_url: '' });
                            setImagePreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                    Product Video <span className="text-neutral-400 font-normal">(Max 50MB)</span>
                  </label>

                  {!videoFile && !formData.video_url ? (
                    <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mb-2">
                        <Video className="w-5 h-5" />
                      </div>
                      <p className="font-sans font-medium text-sm text-neutral-900">
                        Click to upload video
                      </p>
                      <p className="font-sans text-xs text-neutral-500 mt-1">
                        MP4, WebM or Ogg (Max 50MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg bg-neutral-50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Video className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans font-medium text-sm text-neutral-900 truncate">
                            {videoFile ? videoFile.name : 'Existing Video'}
                          </p>
                          <p className="font-sans text-xs text-neutral-500">
                            {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Uploaded'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoFile(null);
                          setFormData({ ...formData, video_url: '' });
                        }}
                        className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {isUploading && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 text-right">
                        Uploading: {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-sans font-medium text-xs md:text-sm text-neutral-700 mb-1 md:mb-2">
                    Product Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PREDEFINED_TAGS.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleTagToggle(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${formData.tags.includes(tag.id)
                          ? 'bg-primary-50 border-primary-200 text-primary-700'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                          }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  <ProductTagsInput
                    tags={formData.tags.filter(t => !PREDEFINED_TAGS.find(pt => pt.id === t))}
                    onChange={(customTags) => {
                      // Merge custom tags with selected predefined tags
                      const predefined = formData.tags.filter(t => PREDEFINED_TAGS.find(pt => pt.id === t));
                      setFormData({ ...formData, tags: [...predefined, ...customTags] });
                    }}
                  />
                  <p className="font-sans text-xs text-neutral-500 mt-1">
                    Select from tags or type to add custom ones
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 md:gap-4">
              <Button
                type="button"
                onClick={() => navigate('/vendor/products')}
                className="flex-1 h-10 md:h-12 bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 font-sans font-semibold text-sm md:text-base rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-10 md:h-12 bg-green-700 hover:bg-green-800 text-white font-sans font-semibold text-sm md:text-base rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 md:w-5 md:h-5" />
                    {isEditing ? 'Update Product' : 'Create Product'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
