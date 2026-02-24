import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

export default function LandingPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [banners, setBanners] = useState([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(1);

    const [categorySerials, setCategorySerials] = useState({});

    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(res => res.json()),
            fetch('/api/settings').then(res => res.json())
        ])
            .then(([productsData, settingsData]) => {
                // Ensure products is an array to avoid crash on rendering
                setProducts(Array.isArray(productsData) ? productsData : []);

                if (settingsData && settingsData.store_categories) {
                    try {
                        const parsed = JSON.parse(settingsData.store_categories);
                        const serialMap = {};
                        parsed.forEach(c => {
                            serialMap[c.name] = c.serial;
                        });
                        setCategorySerials(serialMap);
                    } catch (e) {
                        console.error("Failed to parse settings:", e);
                    }
                }

                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch data:', err);
                setLoading(false);
            });
    }, []);

    // Fetch banners
    useEffect(() => {
        fetch('/api/banners')
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    setBanners(data);
                }
            })
            .catch(err => console.error("Failed to fetch banners:", err));
    }, []);

    const [isTransitioning, setIsTransitioning] = useState(true);
    const [lastInteraction, setLastInteraction] = useState(Date.now());

    // Rotate banners
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setCurrentBannerIndex(prev => prev + 1);
        }, 5000); // Change banner every 5 seconds
        return () => clearInterval(interval);
    }, [banners, lastInteraction]);

    // Handle infinite loop logic
    useEffect(() => {
        if (banners.length <= 1) return;
        if (currentBannerIndex === banners.length + 1) {
            // Reached the cloned first slide at the end, wait for transition then snap back to original first slide
            const timeout = setTimeout(() => {
                setIsTransitioning(false); // Turn off transition for the instant snap
                setCurrentBannerIndex(1);
            }, 800); // Match this with CSS transition duration
            return () => clearTimeout(timeout);
        }
        if (currentBannerIndex === 0) {
            // Reached the cloned last slide at the beginning, wait for transition then snap to original last slide
            const timeout = setTimeout(() => {
                setIsTransitioning(false);
                setCurrentBannerIndex(banners.length);
            }, 800);
            return () => clearTimeout(timeout);
        }
    }, [currentBannerIndex, banners.length]);

    const [touchStartX, setTouchStartX] = useState(0);

    const handleSwipe = (direction) => {
        if (currentBannerIndex === 0 || currentBannerIndex === banners.length + 1) return;
        setLastInteraction(Date.now());
        setIsTransitioning(true);
        if (direction === 'left') {
            setCurrentBannerIndex(prev => prev + 1);
        } else {
            setCurrentBannerIndex(prev => prev - 1);
        }
    };

    const handleTouchStart = (e) => setTouchStartX(e.changedTouches[0].screenX);
    const handleTouchEnd = (e) => {
        const endX = e.changedTouches[0].screenX;
        if (touchStartX - endX > 50) handleSwipe('left');
        else if (endX - touchStartX > 50) handleSwipe('right');
    };

    // Derived array of banners to render
    const displayBanners = banners;

    // Add a clone of the last banner to the start, and the first banner to the end
    const renderBanners = displayBanners.length > 1 ? [displayBanners[displayBanners.length - 1], ...displayBanners, displayBanners[0]] : displayBanners;

    // Safety check for active title/subtitle mapping
    const getActiveBanner = () => {
        if (displayBanners.length === 0) return {};
        if (displayBanners.length === 1) return displayBanners[0];
        if (currentBannerIndex === displayBanners.length + 1) return displayBanners[0];
        if (currentBannerIndex === 0) return displayBanners[displayBanners.length - 1];
        return displayBanners[currentBannerIndex - 1] || {};
    };
    const activeBanner = getActiveBanner();

    // The index used for visual positioning
    const visualIndex = displayBanners.length > 1 ? currentBannerIndex : 0;

    return (
        <div className="landing-page">
            {/* Hero Section */}
            {displayBanners.length > 0 ? (
                <section
                    className="hero-section hero"
                    style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y' }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={(e) => setTouchStartX(e.clientX)}
                    onMouseUp={(e) => {
                        const endX = e.clientX;
                        if (touchStartX - endX > 50) handleSwipe('left');
                        else if (endX - touchStartX > 50) handleSwipe('right');
                    }}
                >
                    {/* Sliding Banners Track */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        transform: `translateX(-${(visualIndex / renderBanners.length) * 100}%)`,
                        transition: isTransitioning ? 'transform 0.8s ease-in-out' : 'none',
                        width: `${renderBanners.length * 100}%`
                    }}>
                        {renderBanners.map((banner, idx) => (
                            <div key={`${banner.id || idx}-${idx}`} style={{
                                width: `${100 / renderBanners.length}%`,
                                height: '100%',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {/* Background Image */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundImage: `url("${banner.imageUrl}")`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center 30%',
                                    filter: 'brightness(0.9)',
                                    zIndex: 1
                                }}></div>

                                {/* Banner Content */}
                                <div className="container text-center" style={{ position: 'relative', zIndex: 10, color: 'white' }}>
                                    {banner.title && (
                                        <h1 className="banner-title" style={{
                                            marginBottom: 'var(--space-md)',
                                            textShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                            animation: currentBannerIndex === idx ? 'fadeInUp 0.8s ease-out' : 'none'
                                        }}>
                                            {banner.title}
                                        </h1>
                                    )}

                                    {banner.subtitle && (
                                        <p className="banner-subtitle" style={{
                                            maxWidth: '800px',
                                            margin: '0 auto',
                                            animation: currentBannerIndex === idx ? 'fadeInUp 1s ease-out' : 'none',
                                            textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                                        }}>
                                            {banner.subtitle}
                                        </p>
                                    )}
                                </div>

                                {/* Absolute Bottom Button */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '10%',
                                    left: '0',
                                    right: '0',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    zIndex: 10
                                }}>
                                    <button className="btn banner-btn" style={{ animation: currentBannerIndex === idx ? 'fadeInUp 1.2s ease-out' : 'none' }} onClick={() => {
                                        document.getElementById('collection').scrollIntoView({ behavior: 'smooth' });
                                    }}>
                                        Explore Collection
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : (
                <div style={{ height: '80px' }}></div> /* Spacer for navbar when no hero exists */
            )}

            {/* Featured Collection Section */}
            <section id="collection" className="section container">
                <div className="text-center" style={{ marginBottom: 'var(--space-xl)' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>The Collection</h2>
                    <div style={{ width: '40px', height: '2px', backgroundColor: 'var(--color-accent)', margin: '0 auto' }}></div>
                </div>

                {loading ? (
                    <div className="text-center text-muted">Curating collection...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                        {Object.entries(
                            (Array.isArray(products) ? products : []).reduce((acc, product) => {
                                const cat = product.category || 'Other Collection';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(product);
                                return acc;
                            }, {})
                        ).sort((a, b) => {
                            const catA = a[0];
                            const catB = b[0];
                            const serialA = categorySerials[catA] ?? 9999;
                            const serialB = categorySerials[catB] ?? 9999;

                            if (serialA !== serialB) {
                                return serialA - serialB;
                            }
                            return catA.localeCompare(catB);
                        }).map(([category, categoryProducts]) => (
                            <div key={category}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-lg)', padding: '0 var(--space-md)' }}>
                                    <h3 style={{
                                        fontSize: '1.75rem',
                                        margin: 0,
                                        fontFamily: '"Playfair Display", serif',
                                        color: 'var(--color-text-primary)'
                                    }}>
                                        {category}
                                    </h3>
                                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }}></div>
                                </div>
                                <div className="product-category-grid">
                                    {categoryProducts.slice(0, 7).map(product => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                    {categoryProducts.length > 7 && (
                                        <Link
                                            to={category === 'Other Collection' ? '/store' : `/store?category=${encodeURIComponent(category)}`}
                                            style={{
                                                textDecoration: 'none',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: 'var(--color-surface)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px dashed var(--color-border)',
                                                padding: '2rem',
                                                transition: 'all 0.3s ease',
                                                cursor: 'pointer',
                                                minHeight: '250px'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                                        >
                                            <div style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--color-bg-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginBottom: '1.5rem',
                                                color: 'var(--color-primary)',
                                                transition: 'transform 0.3s ease'
                                            }}>
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 16 12 12 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                            </div>
                                            <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-text-primary)', textAlign: 'center' }}>View All</h3>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>
                                                {categoryProducts.length - 7} more {categoryProducts.length - 7 === 1 ? 'item' : 'items'}
                                            </p>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
