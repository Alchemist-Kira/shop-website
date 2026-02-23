import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ProductPage from './pages/ProductPage';
import OrderPage from './pages/OrderPage';
import StorePage from './pages/StorePage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminProducts from './admin/AdminProducts';
import AdminBanners from './admin/AdminBanners';
import AdminSettings from './admin/AdminSettings';
import AdminLogin from './admin/AdminLogin';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const [cartCount, setCartCount] = useState(0);
  const [authStatus, setAuthStatus] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // Scroll restoration logic
  useEffect(() => {
    setIsMobileMenuOpen(false);

    // Save scroll position constantly while on store or home
    const handleScroll = () => {
      if (location.pathname === '/' || location.pathname === '/store') {
        sessionStorage.setItem(`scrollPosition-${location.pathname}`, window.scrollY.toString());
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // When navigating TO home or store
    if (location.pathname === '/' || location.pathname === '/store') {
      const savedScroll = sessionStorage.getItem(`scrollPosition-${location.pathname}`);
      // Use setTimeout to ensure the DOM has rendered products before scrolling
      setTimeout(() => {
        if (savedScroll !== null) {
          window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      }, 50);
    } else {
      // Navigating TO a product page or other page
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location]);

  // Load cart from local storage just to update the counter
  useEffect(() => {
    const handleStorage = () => {
      const cart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };

    const checkAuth = () => {
      setAuthStatus(!!(localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')));
    };

    // Initial fetch
    handleStorage();
    checkAuth();

    // Custom event to listen for cart updates within the same window
    window.addEventListener('cartUpdated', handleStorage);
    window.addEventListener('authStatusChanged', checkAuth);

    return () => {
      window.removeEventListener('cartUpdated', handleStorage);
      window.removeEventListener('authStatusChanged', checkAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
    window.dispatchEvent(new Event('authStatusChanged'));
  };

  const executeSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      navigate(`/store?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <>
      {/* Navigation - Hidden on admin routes */}
      <Routes>
        <Route path="/admin/*" element={null} />
        <Route path="*" element={
          <header style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--color-border)',
            zIndex: 100
          }}>
            <div className="container flex items-center justify-between" style={{ height: '80px' }}>

              {/* Left Side: Mobile Hamburger OR Desktop Links */}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  className="mobile-menu-btn"
                  onClick={() => setIsMobileMenuOpen(true)}
                  style={{ display: 'flex', padding: '0.5rem', marginRight: '1rem', color: 'var(--color-text-primary)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <nav className="desktop-nav-links flex items-center gap-md">
                  <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>Home</Link>
                  <Link to="/store" style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>Store</Link>
                  <a href="/#collection" style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>Collection</a>
                </nav>
              </div>

              {/* Center: Logo */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link to="/" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '0.05em', fontFamily: '"Playfair Display", serif', color: '#b38122', margin: 0 }}>
                  Marbilo
                </Link>
              </div>

              {/* Right Side: Search and Cart */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', flex: 1 }}>
                <button onClick={() => setIsSearchOpen(!isSearchOpen)} style={{ color: 'var(--color-text-primary)', padding: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
                <Link to="/order" style={{ fontWeight: 500, display: 'flex', alignItems: 'center', position: 'relative', padding: '0.5rem', color: 'var(--color-text-primary)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                  {cartCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '0px',
                      right: '0px',
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontSize: '0.7rem',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      transform: 'translate(25%, -25%)'
                    }}>
                      {cartCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* Search Overlay Dropdown */}
            {isSearchOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', padding: '1.5rem', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
                <form onSubmit={executeSearch} className="container" style={{ display: 'flex', gap: '1rem', maxWidth: '600px' }}>
                  <input
                    type="text"
                    placeholder="Search Panjabis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', outline: 'none' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Search</button>
                </form>
              </div>
            )}
          </header>
        } />
      </Routes>

      {/* Mobile Drawer Menu */}
      <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: '"Playfair Display", serif', color: '#b38122', margin: 0 }}>Menu</h2>
          <button onClick={() => setIsMobileMenuOpen(false)} style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>&times;</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '1.25rem' }}>
          <Link to="/" onClick={() => { setIsMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Home</Link>
          <Link to="/store" onClick={() => setIsMobileMenuOpen(false)} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Store</Link>
          <a href="/#collection" onClick={() => setIsMobileMenuOpen(false)} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Collection</a>
        </nav>
      </div>

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/order" element={<OrderPage />} />

          <Route path="/admin" element={authStatus ? <AdminLayout onLogout={handleLogout} /> : <AdminLogin />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* Footer - Hidden on admin routes */}
      <Routes>
        <Route path="/admin/*" element={null} />
        <Route path="*" element={
          <footer className="site-footer">
            <div className="container">
              <div className="footer-grid">
                {/* Brand Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <h2 style={{ fontSize: '2.5rem', letterSpacing: '0.05em', fontFamily: '"Playfair Display", serif', color: 'white', margin: 0 }}>Marbilo</h2>
                  <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '350px', lineHeight: 1.6, margin: 0 }}>
                    Our collection brings together traditional artistry and contemporary style, designed for the modern gentleman who values heritage and elegance.
                  </p>
                </div>

                {/* Navigation Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <h4 style={{ color: 'white', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Explore</h4>
                  <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Link to="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--color-accent)'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.6)'}>Home</Link>
                    <Link to="/store" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--color-accent)'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.6)'}>Store</Link>
                    <a href="/#collection" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--color-accent)'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.6)'}>Collections</a>
                  </nav>
                </div>

                {/* Contact/Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <h4 style={{ color: 'white', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Find Us</h4>
                  <a
                    href="https://maps.app.goo.gl/Mj2XFpHq3JqykFBfA?g_st=ic"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'flex', gap: '12px', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '4px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                      Plot No-7, Salam Tawar, Road-16, Apollo gate, Basundhara, Dhaka-1204, Bangladesh.
                    </div>
                  </a>
                  {/* Phone Numbers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <a href="tel:+8801622154810" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'flex', gap: '12px', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      <span style={{ fontSize: '0.95rem' }}>+8801622154810</span>
                    </a>
                    <a href="tel:+8801852750044" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'flex', gap: '12px', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      <span style={{ fontSize: '0.95rem' }}>+8801852750044</span>
                    </a>
                  </div>
                  {/* Social Links */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <a href="https://www.facebook.com/share/1H2qD63H5z/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.color = '#1877F2'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                      <span style={{ fontSize: '0.95rem' }}>Facebook</span>
                    </a>
                    <a href="https://wa.me/8801852750044" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.6)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.color = '#25D366'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                      <span style={{ fontSize: '0.95rem' }}>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Bottom Bar */}
              <div style={{
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-md)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.85rem'
              }}>
                <div>
                  &copy; {new Date().getFullYear()} Marbilo. All rights reserved.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Developed by</span>
                  <a
                    href="https://imranabid.pages.dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '0.5px', textDecoration: 'none', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.target.style.textDecoration = 'none'}
                  >
                    Imran.
                  </a>
                </div>
              </div>
            </div>
          </footer>
        } />
      </Routes>
    </>
  );
}

export default App;
