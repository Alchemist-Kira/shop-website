import { useState, useEffect } from 'react';
import { useToast } from '../components/ToastProvider';

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        delivery_inside: '60',
        delivery_outside: '120',
        notification_sound_enabled: 'true',
        store_categories: '[]' // Will hold JSON string
    });

    const [localShipping, setLocalShipping] = useState({
        inside: '60',
        outside: '120'
    });

    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryName, setEditingCategoryName] = useState(null);
    const [editCategoryInput, setEditCategoryInput] = useState('');
    const [localSerialInputs, setLocalSerialInputs] = useState({});
    const [loading, setLoading] = useState(true);
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch('/api/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data }));

                setLocalShipping({
                    inside: data.delivery_inside || '60',
                    outside: data.delivery_outside || '120'
                });

                if (data.store_categories) {
                    try {
                        let parsed = JSON.parse(data.store_categories);
                        // Sort by serial
                        parsed.sort((a, b) => a.serial - b.serial);
                        setCategories(parsed);

                        // Initialize local serial inputs map
                        const serialsMap = {};
                        parsed.forEach(c => {
                            serialsMap[c.name] = c.serial.toString();
                        });
                        setLocalSerialInputs(serialsMap);
                    } catch (e) {
                        console.error("Failed to parse categories", e);
                    }
                }
            }
            setLoading(false);
            setTimeout(() => setInitialLoadDone(true), 100);
        } catch (err) {
            console.error(err);
            setLoading(false);
            setTimeout(() => setInitialLoadDone(true), 100);
        }
    };

    // Auto-save effect
    useEffect(() => {
        if (!initialLoadDone) return;
        const timer = setTimeout(() => {
            autoSaveSettings();
        }, 1000); // 1-second debounce
        return () => clearTimeout(timer);
    }, [settings, categories, initialLoadDone]);

    const autoSaveSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');

            // Serialize categories back to string
            const updatedSettings = {
                ...settings,
                store_categories: JSON.stringify(categories)
            };

            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedSettings)
            });

            if (!res.ok) {
                addToast('Failed to auto-save settings.', 'error');
            }
        } catch (err) {
            addToast('An error occurred.', 'error');
        }
        setSaving(false);
    };

    // Category Handlers
    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;

        // Prevent duplicates
        if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            alert("Category already exists!");
            return;
        }

        const nextSerial = categories.length > 0 ? Math.max(...categories.map(c => c.serial)) + 1 : 1;
        setCategories([...categories, { name: newCategoryName.trim(), serial: nextSerial }]);
        setLocalSerialInputs({ ...localSerialInputs, [newCategoryName.trim()]: nextSerial.toString() });
        setNewCategoryName('');
    };

    const handleRemoveCategory = (name) => {
        if (confirm(`Are you sure you want to remove ${name}?`)) {
            setCategories(categories.filter(c => c.name !== name));
            const newSerialsMap = { ...localSerialInputs };
            delete newSerialsMap[name];
            setLocalSerialInputs(newSerialsMap);
        }
    };

    const handleLocalSerialChange = (name, val) => {
        setLocalSerialInputs({ ...localSerialInputs, [name]: val });
    };

    const applyCategorySerialChange = (name, newSerialStr) => {
        let newSerial = parseInt(newSerialStr) || 1;
        if (newSerial < 1) newSerial = 1;
        if (newSerial > categories.length) newSerial = categories.length;

        const targetCategory = categories.find(c => c.name === name);
        if (!targetCategory || targetCategory.serial === newSerial) return;

        const otherCategories = categories.filter(c => c.name !== name).sort((a, b) => a.serial - b.serial);
        // Insert the target category at its new position (0-indexed)
        otherCategories.splice(newSerial - 1, 0, targetCategory);

        // Re-assign all serials cleanly from 1 to N
        const updated = otherCategories.map((c, idx) => ({ ...c, serial: idx + 1 }));
        setCategories(updated);

        // Sync local inputs map with updated true serials
        const updatedSerialsMap = {};
        updated.forEach(c => {
            updatedSerialsMap[c.name] = c.serial.toString();
        });
        setLocalSerialInputs(updatedSerialsMap);
    };

    const startEditingCategory = (name) => {
        setEditingCategoryName(name);
        setEditCategoryInput(name);
    };

    const saveEditedCategoryName = async (oldName) => {
        const newName = editCategoryInput.trim();
        if (newName && newName !== oldName) {
            if (categories.some(c => c.name.toLowerCase() === newName.toLowerCase() && c.name !== oldName)) {
                alert("Category already exists!");
                return;
            }

            // First update the local categories state
            const updatedCategories = categories.map(c => c.name === oldName ? { ...c, name: newName } : c);
            setCategories(updatedCategories);

            // Fetch all products that use this category and update them
            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');

                // Fetch all products
                const res = await fetch('/api/products');
                if (res.ok) {
                    const products = await res.json();

                    // Find products using the old category name
                    const productsToUpdate = products.filter(p => p.category === oldName);

                    // Update each product
                    for (const product of productsToUpdate) {
                        const formData = new FormData();
                        formData.append('name', product.name);
                        formData.append('description', product.description);
                        formData.append('price', product.price);
                        formData.append('category', newName); // Update category

                        // Parse sizes and colors, fallback to empty array
                        const sizesStr = typeof product.sizes === 'string' ? product.sizes : JSON.stringify(product.sizes || []);
                        const colorsStr = typeof product.colors === 'string' ? product.colors : JSON.stringify(product.colors || []);
                        const tagsStr = typeof product.tags === 'string' ? product.tags : JSON.stringify(product.tags || []);

                        formData.append('sizes', sizesStr);
                        formData.append('colors', colorsStr);
                        formData.append('tags', tagsStr);

                        if (product.discountPrice) formData.append('discountPrice', product.discountPrice);
                        if (product.previousPrice) formData.append('previousPrice', product.previousPrice);
                        if (product.stock !== undefined) formData.append('stock', product.stock);

                        // Keep existing images
                        const imagesArr = typeof product.images === 'string' ? JSON.parse(product.images) : [];
                        if (imagesArr.length === 0 && product.imageUrl) {
                            imagesArr.push(product.imageUrl);
                        }
                        formData.append('existingImages', JSON.stringify(imagesArr));

                        await fetch(`/api/products/${product.id}`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
                    }

                    if (productsToUpdate.length > 0) {
                        addToast(`Updated category for ${productsToUpdate.length} product(s)`, 'success');
                    }
                }
            } catch (err) {
                console.error("Failed to update products with new category name:", err);
                addToast("Error updating products with new category", "error");
            }
        }
        setEditingCategoryName(null);
    };

    const cancelEditingCategory = () => {
        setEditingCategoryName(null);
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading settings...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '2rem', fontFamily: '"Playfair Display", serif', margin: 0 }}>Store Settings</h1>
                {saving && <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Auto-saving...</span>}
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>

                {/* General Settings */}
                <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>General Configuration</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>New Order Sound Notification</label>
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Play a sound on the dashboard when a new order arrives</span>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.notification_sound_enabled === 'true'}
                                    onChange={(e) => setSettings({ ...settings, notification_sound_enabled: e.target.checked ? 'true' : 'false' })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: settings.notification_sound_enabled === 'true' ? 'var(--color-accent)' : '#ccc',
                                    transition: '.4s', borderRadius: '24px'
                                }}>
                                    <span style={{
                                        position: 'absolute', height: '18px', width: '18px', left: settings.notification_sound_enabled === 'true' ? '28px' : '3px', bottom: '3px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                    }}></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Shipping Settings */}
                <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Shipping Rates (৳)</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1.5rem' }}>
                        <div>
                            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Inside Dhaka</label>
                            <input
                                type="number"
                                value={localShipping.inside}
                                onChange={(e) => setLocalShipping({ ...localShipping, inside: e.target.value })}
                                onBlur={() => setSettings({ ...settings, delivery_inside: localShipping.inside })}
                                onKeyDown={(e) => e.key === 'Enter' && setSettings({ ...settings, delivery_inside: localShipping.inside })}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Outside Dhaka</label>
                            <input
                                type="number"
                                value={localShipping.outside}
                                onChange={(e) => setLocalShipping({ ...localShipping, outside: e.target.value })}
                                onBlur={() => setSettings({ ...settings, delivery_outside: localShipping.outside })}
                                onKeyDown={(e) => e.key === 'Enter' && setSettings({ ...settings, delivery_outside: localShipping.outside })}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Categories Management */}
                <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Product Categories</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                        Manage the categories available when adding products. The serial determines the order they are displayed in filters.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <input
                            type="text"
                            placeholder="New category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', minWidth: '120px' }}
                        />
                        <button onClick={handleAddCategory} className="btn" style={{ backgroundColor: 'var(--color-text-primary)', color: 'white', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
                            Add Category
                        </button>
                    </div>

                    {categories.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                            No categories defined yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {categories.map((cat, index) => (
                                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: '#fafafa' }}>
                                    {editingCategoryName === cat.name ? (
                                        <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={editCategoryInput}
                                                onChange={e => setEditCategoryInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveEditedCategoryName(cat.name)}
                                                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--color-primary)', borderRadius: '4px' }}
                                                autoFocus
                                            />
                                            <button onClick={() => saveEditedCategoryName(cat.name)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', borderRadius: '4px' }}>Save</button>
                                            <button onClick={cancelEditingCategory} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#e0e0e0', color: '#333', borderRadius: '4px' }}>Cancel</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ flex: 1, fontWeight: 500 }}>{cat.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Serial:</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={localSerialInputs[cat.name] !== undefined ? localSerialInputs[cat.name] : cat.serial}
                                                        onChange={(e) => handleLocalSerialChange(cat.name, e.target.value)}
                                                        onBlur={() => applyCategorySerialChange(cat.name, localSerialInputs[cat.name])}
                                                        onKeyDown={(e) => e.key === 'Enter' && applyCategorySerialChange(cat.name, localSerialInputs[cat.name])}
                                                        style={{ width: '60px', padding: '0.25rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', textAlign: 'center' }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => startEditingCategory(cat.name)}
                                                    style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                                    title="Edit Category"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveCategory(cat.name)}
                                                    style={{ color: '#d9381e', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                                    title="Remove Category"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
