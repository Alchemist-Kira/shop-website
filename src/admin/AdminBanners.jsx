import { useState, useEffect } from 'react';
import { useToast } from '../components/ToastProvider';

export default function AdminBanners() {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    // Form state for adding a new banner
    const [formData, setFormData] = useState({ title: '', subtitle: '' });
    const [imageFile, setImageFile] = useState(null);

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = () => {
        setLoading(true);
        fetch('http://localhost:3001/api/banners')
            .then(res => res.json())
            .then(data => {
                setBanners(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching banners:", err);
                addToast("Failed to load banners", "error");
                setLoading(false);
            });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleAddBanner = async (e) => {
        e.preventDefault();
        if (!imageFile) {
            addToast("Please select an image file first.", "error");
            return;
        }

        setIsSaving(true);
        const submitData = new FormData();
        submitData.append('title', formData.title);
        submitData.append('subtitle', formData.subtitle);
        submitData.append('image', imageFile);

        const token = localStorage.getItem('admin_token');
        try {
            const response = await fetch('http://localhost:3001/api/banners', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: submitData
            });

            if (response.ok) {
                addToast("Banner added successfully", "success");
                setFormData({ title: '', subtitle: '' });
                setImageFile(null);
                // Reset standard file input via direct DOM access since we only have one
                const fileInput = document.getElementById('banner-image-input');
                if (fileInput) fileInput.value = '';
                fetchBanners();
            } else {
                addToast("Failed to add banner", "error");
            }
        } catch (error) {
            console.error("Add banner error:", error);
            addToast("Network error while adding banner", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBanner = async (id) => {
        if (!window.confirm("Are you sure you want to delete this banner? The image file will be permanently removed from the server.")) return;

        const token = localStorage.getItem('admin_token');
        try {
            const response = await fetch(`http://localhost:3001/api/banners/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                addToast("Banner deleted successfully", "success");
                fetchBanners();
            } else {
                addToast("Failed to delete banner", "error");
            }
        } catch (error) {
            addToast("Error deleting banner", "error");
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Hero Banners</h1>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Left Side: Upload Form */}
                <div style={{ flex: '1 1 350px', backgroundColor: 'white', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)', fontWeight: 600 }}>Upload New Banner</h2>
                    <form onSubmit={handleAddBanner} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>IMAGE FILE *</label>
                            <input
                                id="banner-image-input"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>TITLE (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. The Aesthetic Edition"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>SUBTITLE (Optional)</label>
                            <textarea
                                placeholder="e.g. Discover our latest collection..."
                                value={formData.subtitle}
                                onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                                rows="3"
                                style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', resize: 'vertical' }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSaving || !imageFile}
                            style={{ padding: '12px', marginTop: 'var(--space-sm)' }}
                        >
                            {isSaving ? 'Uploading...' : 'Save Banner'}
                        </button>
                    </form>
                </div>

                {/* Right Side: Existing Banners List */}
                <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {loading ? (
                        <div className="text-center text-muted" style={{ padding: 'var(--space-xl)' }}>Loading banners...</div>
                    ) : banners.length === 0 ? (
                        <div className="text-center text-muted" style={{ padding: 'var(--space-xl)', backgroundColor: 'white', borderRadius: 'var(--radius-lg)' }}>No banners uploaded yet.</div>
                    ) : (
                        banners.map(banner => (
                            <div key={banner.id} style={{ display: 'flex', backgroundColor: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ width: '250px', height: '150px', flexShrink: 0 }}>
                                    <img src={banner.imageUrl} alt={banner.title || 'Banner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ padding: 'var(--space-md) var(--space-lg)', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    {banner.title && <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '4px' }}>{banner.title}</h3>}
                                    {banner.subtitle && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>{banner.subtitle}</p>}
                                    <div style={{ marginTop: 'auto' }}>
                                        <button
                                            onClick={() => handleDeleteBanner(banner.id)}
                                            style={{ color: '#d9381e', fontSize: '0.875rem', fontWeight: 600, padding: '6px 12px', backgroundColor: '#ffefeb', borderRadius: 'var(--radius-sm)' }}
                                            onMouseEnter={e => e.target.style.backgroundColor = '#ffd1c7'}
                                            onMouseLeave={e => e.target.style.backgroundColor = '#ffefeb'}
                                        >
                                            Delete Banner
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
