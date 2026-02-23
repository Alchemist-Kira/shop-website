import { useState, useEffect, useMemo } from 'react';
import { useToast } from '../components/ToastProvider';

export default function AdminProducts() {
    const { addToast } = useToast();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Unified Modal State ('add', 'edit', null)
    const [modalMode, setModalMode] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', description: '', price: 0, previousPrice: 0, stock: 0, sizes: 'M-40, L-42, XL-44', colors: '', tags: '', category: ''
    });
    const [imageFiles, setImageFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [existingImages, setExistingImages] = useState([]);

    useEffect(() => {
        const urls = imageFiles.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
        return () => urls.forEach(url => URL.revokeObjectURL(url));
    }, [imageFiles]);
    const [searchQuery, setSearchQuery] = useState('');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const fetchProducts = () => {
        const token = localStorage.getItem('admin_token');
        fetch('/api/products', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error('Unauthorized');
                return res.json();
            })
            .then(data => {
                setProducts(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch products:', err);
                setLoading(false);
            });
    };

    const fetchSettings = () => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.store_categories) {
                    try {
                        let parsed = JSON.parse(data.store_categories);
                        parsed.sort((a, b) => a.serial - b.serial);
                        setAvailableCategories(parsed.map(c => c.name));
                    } catch (e) { }
                }
            })
            .catch(err => console.error("Failed to fetch settings:", err));
    };

    useEffect(() => {
        fetchProducts();
        fetchSettings();
    }, []);

    const openAddModal = () => {
        setFormData({ name: '', description: '', price: 0, previousPrice: 0, stock: 0, sizes: 'M-40, L-42, XL-44', colors: '', tags: '', category: '' });
        setImageFiles([]);
        setExistingImages([]);
        setEditingId(null);
        setModalMode('add');
    };

    const openEditModal = (product) => {
        const sizesStr = typeof product.sizes === 'string' ? JSON.parse(product.sizes).join(', ') : '';
        const colorsStr = typeof product.colors === 'string' ? JSON.parse(product.colors).join(', ') : '';
        const imagesArr = typeof product.images === 'string' ? JSON.parse(product.images) : [];

        // If product has imageUrl but images is empty (legacy product), add it to existing
        if (imagesArr.length === 0 && product.imageUrl) {
            imagesArr.push(product.imageUrl);
        }

        setFormData({ ...product, sizes: sizesStr, colors: colorsStr });
        setExistingImages(imagesArr);
        setImageFiles([]);
        setEditingId(product.id);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditingId(null);
        setImageFiles([]);
        setExistingImages([]);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.name.trim()) {
            addToast('Product name is required.', 'error');
            return;
        }
        if (!formData.price || isNaN(formData.price) || formData.price <= 0) {
            addToast('A valid product price greater than 0 is required.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const sizesArr = formData.sizes.split(',').map(s => s.trim()).filter(Boolean);
            const colorsArr = formData.colors.split(',').map(c => c.trim()).filter(c => c);
            const tagsArr = formData.tags.split(',').map(t => t.trim()).filter(t => t);

            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('description', formData.description);
            submitData.append('price', formData.price);
            submitData.append('previousPrice', formData.previousPrice || 0);
            submitData.append('stock', formData.stock);
            submitData.append('sizes', JSON.stringify(sizesArr));
            submitData.append('colors', JSON.stringify(colorsArr));
            submitData.append('tags', JSON.stringify(tagsArr));
            submitData.append('category', formData.category);

            // Append all new files to the "images" field array
            Array.from(imageFiles).forEach(file => {
                submitData.append('images', file);
            });

            if (modalMode === 'add') {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: submitData
                });

                if (response.ok) {
                    closeModal();
                    fetchProducts();
                    addToast('Product added successfully', 'success');
                } else {
                    addToast('Failed to add product', 'error');
                }
            } else if (modalMode === 'edit') {
                submitData.append('existingImages', JSON.stringify(existingImages));

                const response = await fetch(`/api/products/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: submitData
                });

                if (response.ok) {
                    closeModal();
                    fetchProducts();
                    addToast('Product updated successfully', 'success');
                } else {
                    addToast('Failed to update product', 'error');
                }
            }
        } catch (err) {
            console.error(err);
            addToast(`Error ${modalMode === 'add' ? 'adding' : 'updating'} product`, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product? Action cannot be undone.')) return;
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                fetchProducts();
                addToast('Product deleted', 'success');
            } else {
                addToast('Failed to delete product. Make sure the backend server is running.', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Error deleting product', 'error');
        }
    };

    const handleRemoveExistingImage = (index) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveNewImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const filteredAndSortedProducts = useMemo(() => {
        let result = [...products];

        // 1. Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.category && p.category.toLowerCase().includes(query)) ||
                (p.description && p.description.toLowerCase().includes(query))
            );
        }

        // 2. Category Filter
        if (categoryFilter) {
            result = result.filter(p => p.category === categoryFilter);
        }

        // 3. Sorting
        result.sort((a, b) => {
            if (sortBy === 'newest') return b.id - a.id;
            if (sortBy === 'oldest') return a.id - b.id;
            if (sortBy === 'price_low') return a.price - b.price;
            if (sortBy === 'price_high') return b.price - a.price;
            if (sortBy === 'stock_low') return a.stock - b.stock;
            if (sortBy === 'stock_high') return b.stock - a.stock;
            return 0;
        });

        return result;
    }, [products, searchQuery, categoryFilter, sortBy]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Inventory Management</h1>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'white' }}
                        >
                            <option value="">All Categories</option>
                            {availableCategories.map((cat, idx) => (
                                <option key={idx} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'white' }}
                        >
                            <option value="newest">Sort: Newest First</option>
                            <option value="oldest">Sort: Oldest First</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="stock_low">Stock: Low to High</option>
                            <option value="stock_high">Stock: High to Low</option>
                        </select>
                    </div>
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none', width: '200px' }}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={openAddModal}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        + Add Product
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-muted">Loading inventory...</div>
            ) : (
                <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                        <thead style={{ backgroundColor: 'var(--color-surface-dim)' }}>
                            <tr>
                                <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Product</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Variants</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Price</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Stock</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedProducts.map(product => {
                                const sizesText = typeof product.sizes === 'string' ? JSON.parse(product.sizes).join(', ') : (Array.isArray(product.sizes) ? product.sizes.join(', ') : '');
                                const colorsText = typeof product.colors === 'string' ? JSON.parse(product.colors).join(', ') : (Array.isArray(product.colors) ? product.colors.join(', ') : '');

                                return (
                                    <tr key={product.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '1rem', maxWidth: '300px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                                <img src={product.imageUrl} alt={product.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                                <div style={{ width: '100%' }}>
                                                    <div style={{ fontWeight: 500 }}>{product.name}</div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: '2px' }}>{product.category || 'Uncategorized'}</div>
                                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                            <div>
                                                <div><strong style={{ color: 'var(--color-text-secondary)' }}>Sizes:</strong> {sizesText}</div>
                                                <div><strong style={{ color: 'var(--color-text-secondary)' }}>Colors:</strong> {colorsText}</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span>{product.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontWeight: 600, color: product.stock === 0 ? '#d9381e' : (product.stock <= 5 ? '#e67300' : 'inherit') }}>{product.stock}</span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <a
                                                    href={`/product/${product.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none', color: 'var(--color-primary)', fontWeight: 600, backgroundColor: 'white' }}
                                                >
                                                    View
                                                </a>
                                                <button onClick={() => openEditModal(product)} style={{ padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer', backgroundColor: 'white' }}>Edit</button>
                                                <button onClick={() => handleDelete(product.id)} style={{ padding: '4px 12px', border: '1px solid #ffefeb', backgroundColor: '#ffefeb', color: '#d9381e', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Unified Add/Edit Product Modal - 2 Column Layout */}
            {modalMode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-lg)' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>

                        {/* Modal Header */}
                        <div style={{ padding: 'var(--space-lg) var(--space-xl)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                {modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
                            </h2>
                            <button onClick={closeModal} style={{ fontSize: '1.5rem', lineHeight: 1, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>&times;</button>
                        </div>

                        {/* Modal Body (2 Columns) */}
                        <div className="admin-modal-grid" style={{ overflowY: 'auto' }}>
                            {/* Left Column: Details */}
                            <div className="admin-modal-col-left">
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PRODUCT NAME</label>
                                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>CATEGORY</label>
                                    <input type="text" list="category-options" placeholder="e.g. Eid Special" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    <datalist id="category-options">
                                        {availableCategories.map((cat, idx) => (
                                            <option key={idx} value={cat}>{cat}</option>
                                        ))}
                                    </datalist>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>DESCRIPTION</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', resize: 'vertical' }} rows={5} />
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PREV PRICE (<strong>৳</strong>)</label>
                                        <input type="number" step="0.01" value={formData.previousPrice} onChange={e => setFormData({ ...formData, previousPrice: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PRICE (<strong>৳</strong>)</label>
                                        <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} onFocus={e => e.target.select()} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>STOCK</label>
                                        <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} onFocus={e => e.target.select()} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Variants and Media */}
                            <div className="admin-modal-col-right">
                                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>AVAILABLE SIZES (COMMA SEPARATED)</label>
                                        <input type="text" placeholder="e.g. S, M, L, XL" value={formData.sizes} onChange={e => setFormData({ ...formData, sizes: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>AVAILABLE COLORS</label>
                                        <input type="text" placeholder="e.g. Red, Blue, Green" value={formData.colors} onChange={e => setFormData({ ...formData, colors: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>SEARCH TAGS (Internal: "summer, formal, blue")</label>
                                    <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>These tags remain hidden but help customers find this product.</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'var(--space-md)' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PRODUCT IMAGES</label>

                                    <div style={{ backgroundColor: 'var(--color-surface-dim)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                            Upload Guidelines
                                        </h4>
                                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                            <li><strong>Orientation:</strong> Portrait (3:4 ratio) is highly recommended.</li>
                                            <li><strong>Formats:</strong> JPG, PNG, or WebP.</li>
                                            <li><strong>Size:</strong> Max 2MB per image for fast loading.</li>
                                        </ul>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {/* Existing Images */}
                                        {existingImages.map((imgUrl, index) => (
                                            <div key={`existing-${index}`} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                                <img src={imgUrl} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                                                <button type="button" onClick={() => handleRemoveExistingImage(index)} style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#d9381e', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Remove existing image">&times;</button>
                                            </div>
                                        ))}

                                        {/* New Images */}
                                        {imageFiles.map((file, index) => (
                                            <div key={`new-${index}`} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                                <img src={previewUrls[index]} alt="New Product" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '2px solid var(--color-primary)' }} />
                                                <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', backgroundColor: 'var(--color-primary)', color: 'white', padding: '2px 6px', borderRadius: '12px', whiteSpace: 'nowrap', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>New</div>
                                                <button type="button" onClick={() => handleRemoveNewImage(index)} style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#d9381e', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Remove new image">&times;</button>
                                            </div>
                                        ))}

                                        {/* Add Image Button */}
                                        <label style={{ width: '80px', height: '80px', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: 'var(--color-surface-dim)', color: 'var(--color-text-secondary)' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            <span style={{ fontSize: '10px', fontWeight: 600 }}>Add Image</span>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onClick={(e) => { e.target.value = null; }}
                                                onChange={e => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const newFiles = Array.from(e.target.files);
                                                        setImageFiles(prev => [...prev, ...newFiles]);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>Select photos to upload.</span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: 'var(--space-lg) var(--space-xl)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', backgroundColor: '#faf9f6' }}>
                            <button onClick={closeModal} style={{ padding: '10px 24px', border: '1px solid var(--color-border)', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Cancel</button>
                            <button onClick={handleSave} className="btn btn-primary" style={{ padding: '10px 32px', fontSize: '1rem' }}>
                                {modalMode === 'add' ? 'Save' : 'Update Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
