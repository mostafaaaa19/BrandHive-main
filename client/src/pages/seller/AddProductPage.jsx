import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, X, ArrowLeft, ChevronRight, Tag, DollarSign, Package, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { categoriesAPI, sellerAPI, brandsAPI } from '../../services/api';

export default function AddProductPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  
  // Data State
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [myBrand, setMyBrand] = useState(null);
  const [allBrands, setAllBrands] = useState([]);
  const [brandLoading, setBrandLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    brand: '',
    price: '',
    stock: '',
    weight: '',
    discountPrice: '',
  });
  const [tagList, setTagList] = useState([]);
  const [tagInput, setTagInput] = useState('');
  
  // Images State
  const [mainImage, setMainImage] = useState(null); // File object
  const [mainImagePreview, setMainImagePreview] = useState(''); // URL
  const [additionalImages, setAdditionalImages] = useState([]); // Array of { file, preview }
  
  // UI State
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitType, setSubmitType] = useState(null); // 'draft' or 'publish'

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await categoriesAPI.getAll();
        const cats = res.data?.data || res.data || [];
        if (cats.length > 0) {
          setCategories(cats);
        } else {
          const { categories: mockCats } = await import('../../data/mockData');
          setCategories(mockCats.map(c => ({ _id: c.id || c.slug, name: c.name })));
        }
      } catch {
        try {
          const { categories: mockCats } = await import('../../data/mockData');
          setCategories(mockCats.map(c => ({ _id: c.id || c.slug, name: c.name })));
        } catch {
          setCategories([]);
        }
      } finally {
        setLoadingCats(false);
      }

      try {
        const brandsRes = await brandsAPI.getAll({ limit: 50 });
        const allBrandsData = brandsRes.data?.data || brandsRes.data || [];
        const activeBrands = Array.isArray(allBrandsData)
          ? allBrandsData.filter(b => b.isActive !== false)
          : [];
        setAllBrands(activeBrands);

        const savedBrandId = localStorage.getItem('brandhive_seller_brand_id');
        if (savedBrandId) {
          const found = activeBrands.find(b => b._id === savedBrandId);
          if (found) {
            setMyBrand(found);
            setFormData(prev => ({ ...prev, brand: found._id }));
            setBrandLoading(false);
            return;
          }
        }

        try {
          const dashRes = await sellerAPI.getDashboard();
          const sellerBrand = dashRes.data?.data?.brand || dashRes.data?.brand;
          if (sellerBrand?._id) {
            setMyBrand(sellerBrand);
            setFormData(prev => ({ ...prev, brand: sellerBrand._id }));
            return;
          }
        } catch {}
      } catch {
        setAllBrands([]);
      } finally {
        setBrandLoading(false);
      }
    };
    fetchInitialData();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tagList.includes(newTag)) {
        setTagList(prev => [...prev, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTagList(prev => prev.filter(t => t !== tagToRemove));
  };

  const calculateDiscount = () => {
    if (formData.price && formData.discountPrice) {
      const price = parseFloat(formData.price);
      const sale = parseFloat(formData.discountPrice);
      if (price > 0 && sale < price) {
        return Math.round(((price - sale) / price) * 100);
      }
    }
    return 0;
  };

  // Image Handling
  const handleMainImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainImage(file);
      setMainImagePreview(URL.createObjectURL(file));
      if (errors.images) setErrors(prev => ({ ...prev, images: null }));
    }
  };

  const removeMainImage = () => {
    setMainImage(null);
    setMainImagePreview('');
  };

  const handleAdditionalImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 4 - additionalImages.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    const newImages = filesToAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setAdditionalImages(prev => [...prev, ...newImages]);
  };

  const removeAdditionalImage = (index) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name || formData.name.length < 3) newErrors.name = 'Name must be at least 3 characters';
    if (!formData.description || formData.description.length < 20) newErrors.description = 'Description must be at least 20 characters';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Price must be greater than 0';
    if (!formData.stock || parseInt(formData.stock) < 0) newErrors.stock = 'Stock cannot be negative';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.brand) {
      newErrors.brand = isRTL
        ? 'يرجى اختيار الماركة'
        : 'Please select a brand';
    }
    if (!mainImage) newErrors.images = 'At least one main image is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (type) => {
    if (!validateForm()) {
      toast.error(
        isRTL
          ? 'يرجى تصحيح الأخطاء'
          : 'Please fix the errors'
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitType(type);

    try {
      const catObj = categories.find(c =>
        c.name === formData.category ||
        c._id === formData.category ||
        c.id === formData.category
      );
      const categoryId = catObj?._id || catObj?.id || formData.category;

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
        category: categoryId,
        brand: formData.brand,
      };

      if (formData.discountPrice && parseFloat(formData.discountPrice) > 0) {
        payload.discountPrice = parseFloat(formData.discountPrice);
      }
      if (formData.weight) {
        payload.weight = parseFloat(formData.weight);
      }
      if (tagList.length > 0) {
        payload.tags = tagList;
      }

      await sellerAPI.createProduct(payload);

      toast.success(
        type === 'draft'
          ? (isRTL ? 'تم الحفظ 📝' : 'Saved as draft! 📝')
          : (isRTL ? 'تم النشر! 🎉' : 'Published! 🎉'),
        { style: { borderRadius: '12px' } }
      );
      navigate('/seller/dashboard?tab=products');
    } catch (err) {
      const errData = err.response?.data;
      const msg = typeof errData?.message === 'string'
        ? errData.message
        : Array.isArray(errData?.message)
          ? errData.message.join(', ')
          : (isRTL ? 'فشل إنشاء المنتج' : 'Failed to create product');

      console.error('Create product error:', errData);
      toast.error(msg, { style: { borderRadius: '12px' } });
    } finally {
      setIsSubmitting(false);
      setSubmitType(null);
    }
  };

  const discount = calculateDiscount();

  return (
    <div className="min-h-screen bg-brand-cream dark:bg-dark-bg py-8">
      <div className="page-container max-w-7xl">
        
        {/* Header & Breadcrumbs */}
        <div className="mb-8">
          <div className="flex items-center text-sm text-gray-500 dark:text-dark-muted mb-4">
            <span>Seller Portal</span>
            <ChevronRight size={14} className="mx-2" />
            <span>Products</span>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-brand-navy dark:text-brand-gold font-medium">Add New Product</span>
          </div>
          
          <Link to="/seller/dashboard" className="inline-flex items-center text-sm text-brand-gold hover:underline mb-2">
            <ArrowLeft size={16} className="mr-1" /> Back to Products
          </Link>
          
          <h1 className="text-3xl font-display font-bold text-brand-navy dark:text-white">Add New Product</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column (60%) - Form */}
          <div className="lg:w-[60%] space-y-6">
            
            {/* Section 1 - Basic Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card p-6">
              <h2 className="text-xl font-display font-bold text-brand-navy dark:text-white mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Handmade Ceramic Vase"
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Describe your product in detail..."
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                  ></textarea>
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                    >
                      <option value="">Select Category</option>
                      {loadingCats ? (
                        <option disabled>Loading...</option>
                      ) : (
                        categories.map((c, i) => (
                          <option key={c._id || i} value={c._id || c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                    {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-gray-700 dark:text-dark-text mb-1 ${isRTL ? 'text-right' : ''}`}>
                      {isRTL ? 'الماركة' : 'Brand'} *
                    </label>
                    {brandLoading ? (
                      <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-dark-border rounded-xl">
                        <div className="w-3 h-3 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                        <span className="text-gray-400 text-sm">Loading...</span>
                      </div>
                    ) : myBrand ? (
                      <div className="w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 flex items-center gap-2">
                        <span className="text-emerald-500 text-xs">✅</span>
                        <span className="text-gray-700 dark:text-dark-text text-sm font-medium">{myBrand.name}</span>
                      </div>
                    ) : (
                      <select
                        name="brand"
                        value={formData.brand}
                        onChange={e => {
                          handleInputChange(e);
                          const selected = allBrands.find(b => b._id === e.target.value);
                          if (selected) setMyBrand(selected);
                        }}
                        className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-4 py-2 focus:border-brand-gold outline-none dark:text-white text-sm"
                      >
                        <option value="">{isRTL ? 'اختر براندك' : 'Select your brand'}</option>
                        {allBrands.map(b => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                    {errors.brand && <p className="text-red-500 text-xs mt-1">{errors.brand}</p>}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section 2 - Pricing & Stock */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card p-6">
              <h2 className="text-xl font-display font-bold text-brand-navy dark:text-white mb-4">Pricing & Stock</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (EGP) *</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg pl-9 pr-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                    />
                  </div>
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Price (EGP)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="discountPrice"
                      value={formData.discountPrice}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg pl-9 pr-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                    />
                  </div>
                  {discount > 0 && <p className="text-emerald-600 text-xs mt-1">Discount: {discount}%</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Quantity *</label>
                  <div className="relative">
                    <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      name="stock"
                      min="0"
                      value={formData.stock}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg pl-9 pr-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                    />
                  </div>
                  {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
                </div>
              </div>
            </motion.div>

            {/* Section 3 - Product Details */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card p-6">
              <h2 className="text-xl font-display font-bold text-brand-navy dark:text-white mb-4">Product Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    name="weight"
                    step="0.1"
                    value={formData.weight}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg px-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                  <div className="relative">
                    <Tag size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="e.g. handmade, ceramic, Egyptian (press Enter)"
                      className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg pl-9 pr-4 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none dark:text-white"
                    />
                  </div>
                  {tagList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tagList.map(tag => (
                        <div key={tag} className="flex items-center gap-1 bg-brand-cream dark:bg-dark-bg px-3 py-1 rounded-full text-sm text-brand-navy dark:text-gray-300 border border-brand-gold/20">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Column (40%) - Image Upload & Preview */}
          <div className="lg:w-[40%] space-y-6">
            
            {/* Image Upload */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card p-6">
              <h2 className="text-xl font-display font-bold text-brand-navy dark:text-white mb-4">Product Images</h2>
              
              <div className="space-y-4">
                {/* Main Image */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleMainImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[240px] transition-colors ${errors.images ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-brand-gold bg-brand-cream dark:bg-dark-bg/50 hover:bg-brand-gold-pale dark:hover:bg-dark-border'}`}>
                    {mainImagePreview ? (
                      <div className="absolute inset-0 z-20">
                        <img src={mainImagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                        <button
                          onClick={(e) => { e.preventDefault(); removeMainImage(); }}
                          className="absolute top-2 right-2 bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white transition-colors shadow-sm"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={32} className="text-brand-gold mb-3" />
                        <p className="text-sm font-medium text-brand-navy dark:text-white mb-1">Click or drag to upload main image</p>
                        <p className="text-xs text-gray-500 dark:text-dark-muted">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </div>
                </div>
                {errors.images && <p className="text-red-500 text-xs mt-1">{errors.images}</p>}

                {/* Additional Images (2x2 Grid) */}
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((index) => {
                    const img = additionalImages[index];
                    return (
                      <div key={index} className="relative aspect-square">
                        {img ? (
                          <div className="w-full h-full relative">
                            <img src={img.preview} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-xl border border-gray-200 dark:border-dark-border" />
                            <button
                              onClick={() => removeAdditionalImage(index)}
                              className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white shadow-sm"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleAdditionalImageChange}
                              disabled={additionalImages.length !== index}
                              className={`absolute inset-0 w-full h-full opacity-0 ${additionalImages.length === index ? 'cursor-pointer z-10' : 'hidden'}`}
                            />
                            <div className={`w-full h-full border-2 border-dashed rounded-xl flex items-center justify-center ${additionalImages.length === index ? 'border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg/50' : 'border-gray-100 dark:border-dark-border/50 bg-gray-50/50 dark:bg-dark-bg/20'}`}>
                              <ImageIcon size={20} className="text-gray-300 dark:text-dark-muted" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Live Preview Card */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-dark-surface rounded-2xl shadow-card p-6">
              <h2 className="text-xl font-display font-bold text-brand-navy dark:text-white mb-4">Preview</h2>
              
              <div className="max-w-[280px] mx-auto">
                <div className="card group cursor-default">
                  <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-dark-bg">
                    {mainImagePreview ? (
                      <img src={mainImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <ImageIcon size={40} className="mb-2 opacity-50" />
                        <span className="text-xs">No image uploaded</span>
                      </div>
                    )}
                    {formData.discountPrice && discount > 0 && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                        -{discount}%
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs text-brand-gold font-medium">
                        {myBrand?.name ||
                          allBrands.find(b => b._id === formData.brand)?.name ||
                          'Your Brand'}
                      </p>
                    </div>
                    <h3 className="font-semibold text-brand-navy dark:text-white mb-2 line-clamp-2 min-h-[48px]">
                      {formData.name || 'Product Name Preview'}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-navy dark:text-white">
                        {formData.discountPrice ? formData.discountPrice : (formData.price || '0.00')} EGP
                      </span>
                      {formData.discountPrice && (
                        <span className="text-sm text-gray-400 line-through">
                          {formData.price} EGP
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Form Actions - Bottom Full Width */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 flex justify-end gap-4 border-t border-gray-200 dark:border-dark-border pt-6">
          <button
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="btn-outline flex items-center justify-center min-w-[140px]"
          >
            {isSubmitting && submitType === 'draft' ? (
              <div className="w-5 h-5 border-2 border-brand-navy dark:border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Save as Draft'
            )}
          </button>
          <button
            onClick={() => handleSubmit('publish')}
            disabled={isSubmitting}
            className="btn-primary flex items-center justify-center min-w-[160px]"
          >
            {isSubmitting && submitType === 'publish' ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Publish Product'
            )}
          </button>
        </motion.div>

      </div>
    </div>
  );
}
