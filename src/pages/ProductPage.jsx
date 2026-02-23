import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

export default function ProductPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [error, setError] = useState('');
    const [activeImage, setActiveImage] = useState('');
    const [imagesList, setImagesList] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [zoomProps, setZoomProps] = useState({ show: false, x: 0, y: 0 });
    const [showLightbox, setShowLightbox] = useState(false);

    useEffect(() => {
        // Extract just the ID from the slug (e.g., '1-midnight-silk' -> '1')
        const numericId = id.split('-')[0];

        fetch(`/api/products/${numericId}`)
            .then(res => {
                if (!res.ok) throw new Error('Product not found');
                return res.json();
            })
            .then(data => {
                // Parse sizes, colors, and images
                const parsedProduct = {
                    ...data,
                    sizes: typeof data.sizes === 'string' ? JSON.parse(data.sizes) : data.sizes,
                    colors: typeof data.colors === 'string' ? JSON.parse(data.colors) : data.colors
                };

                let imgs = typeof data.images === 'string' ? JSON.parse(data.images) : [];
                if (imgs.length === 0 && data.imageUrl) {
                    imgs.push(data.imageUrl); // Fallback for old products
                }

                setImagesList(imgs);
                setActiveImage(imgs[0] || data.imageUrl);
                setProduct(parsedProduct);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    const addToCartLogic = () => {
        const needsSize = product.sizes && product.sizes.length > 0;
        const needsColor = product.colors && product.colors.length > 0;

        if (needsSize && !selectedSize) {
            addToast('Please select a size.', 'error');
            return false;
        }
        if (needsColor && !selectedColor) {
            addToast('Please select a color.', 'error');
            return false;
        }

        const cart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
        const newItem = {
            ...product,
            productId: product.id,
            quantity: quantity,
            selectedSize,
            selectedColor
        };

        // Ensure price is preserved properly for the cart
        newItem.price = Number(product.price);

        const existingItemIndex = cart.findIndex(
            item => item.productId === newItem.productId && item.selectedSize === newItem.selectedSize && item.selectedColor === newItem.selectedColor
        );

        if (existingItemIndex >= 0) {
            cart[existingItemIndex].quantity += quantity;
        } else {
            cart.push(newItem);
        }

        localStorage.setItem('shop_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
        return true;
    };

    const handleAddToCart = () => {
        if (addToCartLogic()) {
            addToast('Added to cart!', 'success');
        }
    };

    const handleBuyNow = () => {
        if (addToCartLogic()) {
            navigate('/order');
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-muted">Loading product details...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <p style={{ color: '#d9381e', fontSize: '1.25rem' }}>{error || 'Product not found.'}</p>
                <button onClick={() => navigate('/')} className="btn btn-primary">Return to Collection</button>
            </div>
        );
    }

    const handleMouseMove = (e) => {
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = ((clientX - left) / width) * 100;
        const y = ((clientY - top) / height) * 100;
        setZoomProps({ show: true, x, y });
    };

    const currentIndex = imagesList.indexOf(activeImage);
    const handlePrevImage = (e) => {
        e.stopPropagation();
        if (imagesList.length <= 1) return;
        if (currentIndex > 0) setActiveImage(imagesList[currentIndex - 1]);
        else setActiveImage(imagesList[imagesList.length - 1]);
    };
    const handleNextImage = (e) => {
        e.stopPropagation();
        if (imagesList.length <= 1) return;
        if (currentIndex < imagesList.length - 1) setActiveImage(imagesList[currentIndex + 1]);
        else setActiveImage(imagesList[0]);
    };

    return (
        <div className="container" style={{ paddingTop: '4rem', paddingBottom: '8rem', maxWidth: '1200px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'start' }}>

                {/* Left Side: Image Gallery */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Main Active Image with proper aspect ratio container to prevent overlap/overflow */}
                    <div
                        className="product-main-image-wrapper"
                        style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '3/4',
                            backgroundColor: '#f5f5f5',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            cursor: 'crosshair',
                            touchAction: 'pan-y' // Allow vertical scrolling on touch
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setZoomProps({ show: false, x: 0, y: 0 })}
                        onTouchEnd={() => setZoomProps({ show: false, x: 0, y: 0 })}
                        onClick={() => {
                            // On small screens, clicking usually means 'expand'
                            if (window.innerWidth <= 768) setShowLightbox(true);
                        }}
                    >
                        <img
                            src={activeImage}
                            alt={product.name}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                transform: zoomProps.show ? 'scale(2.5)' : 'scale(1)',
                                transformOrigin: `${zoomProps.x}% ${zoomProps.y}%`,
                                transition: zoomProps.show ? 'none' : 'transform 0.3s ease'
                            }}
                        />

                        {/* Mobile Zoom Hint */}
                        <div className="mobile-only" style={{
                            position: 'absolute',
                            bottom: '1rem',
                            right: '1rem',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            alignItems: 'center',
                            gap: '4px',
                            pointerEvents: 'none'
                        }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            Tap to Zoom
                        </div>

                        {/* Image Navigation Arrows */}
                        {imagesList.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevImage}
                                    onMouseMove={(e) => { e.stopPropagation(); setZoomProps({ show: false, x: 0, y: 0 }); }}
                                    onTouchMove={(e) => { e.stopPropagation(); setZoomProps({ show: false, x: 0, y: 0 }); }}
                                    style={{
                                        position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)',
                                        width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)',
                                        border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 10,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#333'
                                    }}
                                >
                                    &lt;
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    onMouseMove={(e) => { e.stopPropagation(); setZoomProps({ show: false, x: 0, y: 0 }); }}
                                    onTouchMove={(e) => { e.stopPropagation(); setZoomProps({ show: false, x: 0, y: 0 }); }}
                                    style={{
                                        position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)',
                                        width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.8)',
                                        border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 10,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#333'
                                    }}
                                >
                                    &gt;
                                </button>
                            </>
                        )}
                    </div>

                    {/* Thumbnails Cycler */}
                    {imagesList.length > 1 && (
                        <div className="product-thumbnail-container" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {imagesList.map((img, idx) => (
                                <button
                                    key={idx}
                                    className="product-thumbnail-item"
                                    onClick={() => setActiveImage(img)}
                                    style={{
                                        width: '80px',
                                        height: '106px', // maintaining ~3/4 ratio
                                        flexShrink: 0,
                                        border: activeImage === img ? '2px solid var(--color-accent)' : '2px solid transparent',
                                        borderRadius: 'var(--radius-sm)',
                                        overflow: 'hidden',
                                        padding: 0,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <img src={img} alt={`Thumbnail ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Side: Product Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, marginBottom: 'var(--space-xs)', lineHeight: 1.1 }}>{product.name}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            {product.previousPrice && Number(product.previousPrice) > 0 && Number(product.previousPrice) > Number(product.price) ? (
                                <div style={{ fontSize: 'var(--font-size-lg)', textDecoration: 'line-through', color: 'var(--color-text-secondary)' }}>
                                    {Number(product.previousPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong>
                                </div>
                            ) : null}
                            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--color-accent)' }}>
                                {Number(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        {/* Sizes */}
                        {product.sizes && product.sizes.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-sm)' }}>
                                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Select Size</h3>
                                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                    {product.sizes.map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setSelectedSize(size)}
                                            style={{
                                                padding: '0.75rem 1.5rem',
                                                border: `2px solid ${selectedSize === size ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                                backgroundColor: selectedSize === size ? 'var(--color-accent)' : 'transparent',
                                                color: selectedSize === size ? 'white' : 'var(--color-text-primary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: 600,
                                                fontSize: '1rem',
                                                minWidth: '80px'
                                            }}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Colors */}
                        {product.colors && product.colors.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Select Color</h3>
                                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                    {product.colors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setSelectedColor(color)}
                                            style={{
                                                padding: '0.75rem 1.5rem',
                                                border: `2px solid ${selectedColor === color ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                                                backgroundColor: selectedColor === color ? 'var(--color-surface-dim)' : 'transparent',
                                                color: 'var(--color-text-primary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: 600,
                                                fontSize: '1rem'
                                            }}
                                        >
                                            {color}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 'var(--space-md)' }}>
                            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 'var(--space-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Quantity</h3>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                                >
                                    &minus;
                                </button>
                                <span style={{ padding: '0 1rem', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{quantity}</span>
                                <button
                                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                                    style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
                                    disabled={quantity >= product.stock}
                                >
                                    &#43;
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--space-lg)' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn btn-outline"
                                    style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}
                                    onClick={handleAddToCart}
                                    disabled={product.stock <= 0}
                                >
                                    Add to Cart
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}
                                    onClick={handleBuyNow}
                                    disabled={product.stock <= 0}
                                >
                                    {product.stock > 0 ? 'Buy Now' : 'Out of Stock'}
                                </button>
                            </div>

                            {product.stock > 0 && product.stock <= 5 && (
                                <p style={{ color: '#e67300', fontSize: '0.875rem', marginTop: 'var(--space-md)', textAlign: 'center', fontWeight: 500 }}>
                                    Only {product.stock} left in stock - order soon!
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Product Details / Description moved below buttons */}
                    <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Product Details</h3>
                        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '1.125rem', whiteSpace: 'pre-wrap' }}>
                            {product.description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Breakout grid configuration for CSS media queries fix */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .mobile-only {
                    display: none;
                }

                @media (max-width: 768px) {
                    .container > div {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .product-main-image-wrapper {
                        aspect-ratio: 3 / 4 !important;
                        max-height: 500px;
                        margin: 0 auto;
                    }
                    .product-thumbnail-container {
                        gap: 0.4rem !important;
                        margin-bottom: 0px !important;
                    }
                    .product-thumbnail-item {
                        width: 50px !important;
                        height: 67px !important;
                    }
                    .mobile-only {
                        display: flex;
                    }
                }
            `}} />

            {/* Lightbox / Fullscreen Zoom Modal */}
            {showLightbox && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'black',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden' // Prevent scrolling the modal background
                    }}
                    onClick={() => setShowLightbox(false)}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
                        style={{
                            position: 'fixed', // Keep fixed to screen regardless of zoom
                            top: '20px',
                            right: '20px',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            color: 'black',
                            border: 'none',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            zIndex: 2001,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                    >
                        &times;
                    </button>

                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'auto', // Allow panning if image is larger
                            WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={activeImage}
                            alt={product.name}
                            style={{
                                maxWidth: '100vw',
                                maxHeight: '100vh',
                                objectFit: 'contain',
                                touchAction: 'pan-x pan-y pinch-zoom' // Explicitly allow pinch-zoom and panning
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
