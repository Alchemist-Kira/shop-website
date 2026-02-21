import { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';

export default function LandingPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [banners, setBanners] = useState([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    useEffect(() => {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                setProducts(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch products:', err);
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

    // Rotate banners
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setCurrentBannerIndex(prev => prev + 1);
        }, 5000); // Change banner every 5 seconds
        return () => clearInterval(interval);
    }, [banners]);

    // Handle infinite loop logic
    useEffect(() => {
        if (banners.length <= 1) return;
        if (currentBannerIndex === banners.length) {
            // Reached the cloned first slide, wait for transition to finish then snap back
            const timeout = setTimeout(() => {
                setIsTransitioning(false); // Turn off transition for the instant snap
                setCurrentBannerIndex(0);
            }, 800); // Match this with CSS transition duration
            return () => clearTimeout(timeout);
        }
    }, [currentBannerIndex, banners.length]);

    // Derived array of banners to render
    const displayBanners = banners.length > 0 ? banners : [{
        id: 'default-1',
        imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2000&auto=format&fit=crop',
        title: 'Ethereal Elegance',
        subtitle: 'Discover our curated collection of luxury dresses designed for your most unforgettable moments.'
    }];

    // Add a clone of the first banner to the end for the infinite loop illusion
    const renderBanners = displayBanners.length > 1 ? [...displayBanners, displayBanners[0]] : displayBanners;

    // Safety check for active title/subtitle mapping
    const activeBanner = displayBanners[currentBannerIndex === displayBanners.length ? 0 : currentBannerIndex] || displayBanners[0];

    return (
        <div className="landing-page">
            {/* Hero Section */}
            <section className="hero-section hero">
                {/* Sliding Banners Track */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex',
                    transform: `translateX(-${(currentBannerIndex / renderBanners.length) * 100}%)`,
                    transition: isTransitioning ? 'transform 0.8s ease-in-out' : 'none',
                    width: `${renderBanners.length * 100}%`
                }}>
                    {renderBanners.map((banner, idx) => (
                        <div key={banner.id || idx} style={{
                            width: `${100 / renderBanners.length}%`,
                            height: '100%',
                            backgroundImage: `url("${banner.imageUrl}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center 30%',
                            filter: 'brightness(0.7)'
                        }}></div>
                    ))}
                </div>

                <div className="container relative z-10 text-center" style={{ position: 'relative', zIndex: 10, color: 'white' }}>
                    <h1 style={{
                        fontSize: 'var(--font-size-hero)',
                        marginBottom: 'var(--space-md)',
                        letterSpacing: '0.05em',
                        textShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'opacity 0.5s ease',
                        animation: 'fadeInUp 0.8s ease-out'
                    }} key={`title-${currentBannerIndex}`}>
                        {activeBanner.title}
                    </h1>

                    {activeBanner.subtitle && (
                        <p style={{
                            fontSize: 'var(--font-size-xl)',
                            fontWeight: 300,
                            maxWidth: '600px',
                            margin: '0 auto var(--space-lg) auto',
                            animation: 'fadeInUp 1s ease-out',
                            textShadow: '0 2px 8px rgba(0,0,0,0.5)'
                        }} key={`subtitle-${currentBannerIndex}`}>
                            {activeBanner.subtitle}
                        </p>
                    )}

                    <button className="btn btn-primary" onClick={() => {
                        document.getElementById('collection').scrollIntoView({ behavior: 'smooth' });
                    }}>
                        Explore Collection
                    </button>
                </div>
            </section>

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
                            products.reduce((acc, product) => {
                                const cat = product.category || 'Uncategorized';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(product);
                                return acc;
                            }, {})
                        ).map(([category, categoryProducts]) => (
                            <div key={category}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-lg)' }}>
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
                                    {categoryProducts.map(product => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
