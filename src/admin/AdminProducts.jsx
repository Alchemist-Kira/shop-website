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
        name: '', description: '', price: 0, stock: 0, sizes: 'S, M, L', colors: 'Black, White', category: ''
    });
    const [imageFiles, setImageFiles] = useState([]);
    const [existingImages, setExistingImages] = useState([]);

    // Derived state for dynamic category suggestions
    const existingCategories = useMemo(() => {
        const categories = products.map(p => p.category).filter(Boolean);
        return [...new Set(categories)]; // Returns only unique categories
    }, [products]);

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

    useEffect(() => {
        fetchProducts();
    }, []);

    const openAddModal = () => {
        setFormData({ name: '', description: '', price: 0, stock: 0, sizes: 'S, M, L', colors: 'Black, White', category: '' });
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
        try {
            const token = localStorage.getItem('admin_token');
            const sizesArr = formData.sizes.split(',').map(s => s.trim()).filter(Boolean);
            const colorsArr = formData.colors.split(',').map(c => c.trim()).filter(Boolean);

            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('description', formData.description);
            submitData.append('price', formData.price);
            submitData.append('stock', formData.stock);
            submitData.append('sizes', JSON.stringify(sizesArr));
            submitData.append('colors', JSON.stringify(colorsArr));
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
            const token = localStorage.getItem('admin_token');
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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Inventory Management</h1>
                <button
                    className="btn btn-primary"
                    onClick={openAddModal}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                    + Add Product
                </button>
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
                            {products.map(product => {
                                const sizesText = typeof product.sizes === 'string' ? JSON.parse(product.sizes).join(', ') : '';
                                const colorsText = typeof product.colors === 'string' ? JSON.parse(product.colors).join(', ') : '';

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
                                            <span>৳{product.price.toFixed(2)}</span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontWeight: 600, color: product.stock === 0 ? '#d9381e' : (product.stock <= 5 ? '#e67300' : 'inherit') }}>{product.stock}</span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => openEditModal(product)} style={{ padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>Edit</button>
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
                    <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>

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
                                        {existingCategories.map((cat, idx) => (
                                            <option key={idx} value={cat}>{cat}</option>
                                        ))}
                                    </datalist>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>DESCRIPTION</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', resize: 'vertical' }} rows={5} />
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PRICE (৳)</label>
                                        <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>STOCK QUANTITY</label>
                                        <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Variants and Media */}
                            <div className="admin-modal-col-right">
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>SIZES (COMMA-SEPARATED)</label>
                                    <input type="text" placeholder="e.g. S, M, L, XL" value={formData.sizes} onChange={e => setFormData({ ...formData, sizes: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>COLORS (COMMA-SEPARATED)</label>
                                    <input type="text" placeholder="e.g. Red, Blue, Green" value={formData.colors} onChange={e => setFormData({ ...formData, colors: e.target.value })} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }} />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'var(--space-md)' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>PRODUCT IMAGES (Max 5)</label>
                                    <input type="file" multiple accept="image/*" onChange={e => setImageFiles(e.target.files)} style={{ padding: '12px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-dim)' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Select multiple files by holding Ctrl/Cmd.</span>
                                </div>

                                {existingImages.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>CURRENT IMAGES</label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {existingImages.map((imgUrl, index) => (
                                                <div key={index} style={{ position: 'relative', width: '64px', height: '64px' }}>
                                                    <img src={imgUrl} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                                                    <button onClick={() => handleRemoveExistingImage(index)} style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#d9381e', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer' }}>&times;</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: 'var(--space-lg) var(--space-xl)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', backgroundColor: '#faf9f6' }}>
                            <button onClick={closeModal} style={{ padding: '10px 24px', border: '1px solid var(--color-border)', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Cancel</button>
                            <button onClick={handleSave} className="btn btn-primary" style={{ padding: '10px 32px', fontSize: '1rem' }}>
                                {modalMode === 'add' ? 'Save New Product' : 'Update Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
