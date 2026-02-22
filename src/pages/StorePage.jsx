import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

export default function StorePage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtering States
    const [minPrice, setMinPrice] = useState(0);
    const [maxPriceValue, setMaxPriceValue] = useState(10000);
    const [maxPriceLimit, setMaxPriceLimit] = useState(10000);

    // Dynamic Filter Options
    const [availableCategories, setAvailableCategories] = useState([]);
    const [availableSizes, setAvailableSizes] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSizes, setSelectedSizes] = useState([]);

    const [sortOption, setSortOption] = useState('newest'); // 'newest', 'low-high', 'high-low'

    // Search Query from URL
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const searchQuery = queryParams.get('search') || '';
    const initialCategory = queryParams.get('category');

    useEffect(() => {
        if (initialCategory) {
            setSelectedCategories([initialCategory]);
        }
    }, [initialCategory]);

    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(res => res.json()),
            fetch('/api/settings').then(res => res.json())
        ])
            .then(([productsData, settingsData]) => {
                const validProducts = Array.isArray(productsData) ? productsData : [];
                setProducts(validProducts);

                // Set max price based on available products
                if (validProducts.length > 0) {
                    const highest = Math.max(...validProducts.map(p => Number(p.price)));
                    const niceMax = Math.ceil(highest / 100) * 100;
                    setMaxPriceLimit(niceMax);
                    setMaxPriceValue(niceMax);

                    let settingsCats = [];
                    if (settingsData.store_categories) {
                        try {
                            let parsed = JSON.parse(settingsData.store_categories);
                            parsed.sort((a, b) => a.serial - b.serial);
                            settingsCats = parsed.map(c => c.name);
                        } catch (e) { }
                    }

                    // Extract unique categories from products
                    const productCats = [...new Set(productsData.map(p => p.category).filter(Boolean))];

                    // Merge, preferring the sorted settings categories first, then any legacy ones
                    const finalCats = [...new Set([...settingsCats, ...productCats])];
                    setAvailableCategories(finalCats);

                    // Extract unique sizes
                    const allSizes = new Set();
                    productsData.forEach(p => {
                        try {
                            const parsedSizes = typeof p.sizes === 'string' ? JSON.parse(p.sizes) : p.sizes;
                            if (Array.isArray(parsedSizes)) {
                                parsedSizes.forEach(s => allSizes.add(s));
                            }
                        } catch (e) { }
                    });
                    setAvailableSizes([...allSizes]);
                }

                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch data:', err);
                setLoading(false);
            });
    }, []);

    // Derived filtered and sorted products
    const filteredProducts = products.filter(product => {
        // 1. Filter by Search Query (Name, Description, Category, Tags)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const tags = Array.isArray(product.tags) ? product.tags.join(' ') : (product.tags || '');
            const matchName = product.name?.toLowerCase().includes(query);
            const matchDesc = product.description?.toLowerCase().includes(query);
            const matchCat = product.category?.toLowerCase().includes(query);
            const matchTags = tags.toLowerCase().includes(query);

            if (!matchName && !matchDesc && !matchCat && !matchTags) {
                return false;
            }
        }

        // 2. Filter by Price Range
        if (Number(product.price) < minPrice || Number(product.price) > maxPriceValue) {
            return false;
        }

        // 3. Filter by Category
        if (selectedCategories.length > 0 && !selectedCategories.includes(product.category)) {
            return false;
        }

        // 4. Filter by Sizes
        if (selectedSizes.length > 0) {
            try {
                const parsedSizes = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
                if (Array.isArray(parsedSizes)) {
                    const hasSize = selectedSizes.some(size => parsedSizes.includes(size));
                    if (!hasSize) return false;
                } else {
                    return false;
                }
            } catch (e) { return false; }
        }

        return true;
    }).sort((a, b) => {
        // 3. Sort
        if (sortOption === 'low-high') {
            return Number(a.price) - Number(b.price);
        } else if (sortOption === 'high-low') {
            return Number(b.price) - Number(a.price);
        } else {
            // Newest (assuming larger ID means newer)
            return b.id - a.id;
        }
    });

    const handleClearSearch = () => {
        navigate('/store');
    };

    const handleClearFilters = () => {
        setMinPrice(0);
        setMaxPriceValue(maxPriceLimit);
        setSelectedCategories([]);
        setSelectedSizes([]);
        navigate('/store');
    };

    // Dropdown state for mobile filter
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    return (
        <div className="container" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>

            {/* Header Area */}
            <div style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontFamily: '"Playfair Display", serif', marginBottom: 'var(--space-xs)' }}>
                    Store Collection
                </h1>
            </div>

            {/* Top Bar: Filter Mobile Toggle, Search Query, and Sort */}
            <div className="store-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="mobile-filter-btn"
                        onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        <span style={{ fontWeight: 600 }}>Filter Options</span>
                    </button>

                    {searchQuery && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                            <span>Showing results for: <strong style={{ color: 'var(--color-text-primary)' }}>"{searchQuery}"</strong></span>
                            <button
                                onClick={handleClearSearch}
                                style={{ background: 'none', border: 'none', color: '#d9381e', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="hide-on-mobile" style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Sort By:</span>
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                        style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                    >
                        <option value="newest">Newest Arrivals</option>
                        <option value="low-high">Price: Low to High</option>
                        <option value="high-low">Price: High to Low</option>
                    </select>
                </div>
            </div>

            <div style={{ gap: 'var(--space-xl)' }} className="store-layout-grid">

                {/* Left Sidebar: Filters */}
                <aside className={`store-filter-sidebar ${isMobileFilterOpen ? 'open' : ''}`} style={{ paddingRight: 'var(--space-lg)', position: 'sticky', top: '100px', alignSelf: 'start' }}>

                    <div className="filter-close-btn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Filters</h3>
                        <button onClick={() => setIsMobileFilterOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
                    </div>

                    {/* Price Range Filter */}
                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-md)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Filter by Price</h3>

                        <div style={{ position: 'relative', width: '100%', height: '30px', marginTop: '1rem' }}>
                            {/* 1. Adjusted left and right below to match half the thumb width (e.g., 8px) */}
                            <div style={{ position: 'absolute', left: '8px', right: '8px', top: '50%', transform: 'translateY(-50%)', height: '4px', backgroundColor: '#e5e5e5', borderRadius: '2px', zIndex: 1 }}>
                                {/* The active track will now calculate its percentages based on this newly padded container */}
                                <div style={{
                                    position: 'absolute',
                                    left: `${(minPrice / maxPriceLimit) * 100}%`,
                                    right: `${100 - (maxPriceValue / maxPriceLimit) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#6B6B6B',
                                    borderRadius: '2px'
                                }}></div>
                            </div>

                            <input
                                type="range"
                                min="0"
                                max={maxPriceLimit}
                                step="50"
                                value={minPrice}
                                onChange={(e) => { const val = Math.min(Number(e.target.value), maxPriceValue - 50); setMinPrice(val); }}
                                className="dual-slider"
                                style={{ position: 'absolute', width: '100%', zIndex: minPrice > maxPriceLimit - 100 ? 5 : 3 }}
                            />
                            <input
                                type="range"
                                min="0"
                                max={maxPriceLimit}
                                step="50"
                                value={maxPriceValue}
                                onChange={(e) => { const val = Math.max(Number(e.target.value), minPrice + 50); setMaxPriceValue(val); }}
                                className="dual-slider"
                                style={{ position: 'absolute', width: '100%', zIndex: 4 }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                            <span>Price: <strong style={{ color: 'var(--color-text-primary)' }}>{minPrice} ৳</strong> &mdash; <strong style={{ color: 'var(--color-text-primary)' }}>{maxPriceValue} ৳</strong></span>
                        </div>
                    </div>

                    {/* Category Filter */}
                    {availableCategories.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-md)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Product Categories</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {availableCategories.map(category => (
                                    <label key={category} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            className="filter-checkbox"
                                            checked={selectedCategories.includes(category)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedCategories([...selectedCategories, category]);
                                                else setSelectedCategories(selectedCategories.filter(c => c !== category));
                                            }}
                                        />
                                        <span style={{ color: selectedCategories.includes(category) ? 'var(--color-text-primary)' : 'inherit', fontWeight: selectedCategories.includes(category) ? 500 : 400 }}>{category}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sizes Filter */}
                    {availableSizes.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-md)', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Filter by Size</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {availableSizes.map(size => (
                                    <label key={size} style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            style={{ display: 'none' }}
                                            checked={selectedSizes.includes(size)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedSizes([...selectedSizes, size]);
                                                else setSelectedSizes(selectedSizes.filter(s => s !== size));
                                            }}
                                        />
                                        <div style={{
                                            padding: '6px 12px',
                                            border: `1px solid ${selectedSizes.includes(size) ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
                                            borderRadius: '4px',
                                            fontSize: '0.875rem',
                                            fontWeight: selectedSizes.includes(size) ? 600 : 400,
                                            color: selectedSizes.includes(size) ? 'white' : 'var(--color-text-secondary)',
                                            backgroundColor: selectedSizes.includes(size) ? 'var(--color-text-primary)' : 'transparent',
                                            transition: 'all 0.2s'
                                        }}>
                                            {size}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clear Filters Button */}
                    {(selectedCategories.length > 0 || selectedSizes.length > 0 || minPrice > 0 || maxPriceValue < maxPriceLimit) && (
                        <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-sm)' }}>
                            <button onClick={handleClearFilters} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--color-text-primary)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-full)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.875rem' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-text-primary)'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}>Clear Filters</button>
                        </div>
                    )}
                </aside>

                {/* Right Area: Product Grid */}
                <main style={{ width: '100%' }}>
                    {loading ? (
                        <div className="text-center text-muted" style={{ padding: 'var(--space-xl) 0' }}>Loading products...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center" style={{ padding: 'var(--space-xl) 0', backgroundColor: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>No products found</h3>
                            <p className="text-muted">Try adjusting your filters or search query.</p>
                            {(searchQuery || minPrice > 0 || maxPriceValue < maxPriceLimit || selectedCategories.length > 0 || selectedSizes.length > 0) && (
                                <button
                                    onClick={handleClearFilters}
                                    className="btn btn-primary"
                                    style={{ marginTop: 'var(--space-md)' }}
                                >
                                    Clear All Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="product-category-grid store-page-grid" style={{ padding: 0 }}>
                            {filteredProducts.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Breakout grid config for CSS media queries fix */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media (min-width: 901px) {
                    .mobile-filter-btn { display: none !important; }
                    .filter-close-btn { display: none !important; }
                }
                @media (max-width: 900px) {
                    .hide-on-mobile { display: none !important; }
                    .store-layout-grid {
                        grid-template-columns: 1fr !important;
                        align-items: stretch !important;
                    }
                    .store-filter-sidebar {
                        display: none;
                    }
                    .store-filter-sidebar.open {
                        display: block;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100vw;
                        height: 100vh;
                        background-color: white;
                        z-index: 999;
                        padding: var(--space-xl) var(--space-lg) !important;
                        overflow-y: auto;
                    }
                }
            `}} />
        </div>
    );
}
