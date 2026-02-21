import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ProductPage from './pages/ProductPage';
import OrderPage from './pages/OrderPage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import AdminProducts from './admin/AdminProducts';
import AdminBanners from './admin/AdminBanners';
import AdminLogin from './admin/AdminLogin';

function App() {
  const [cartCount, setCartCount] = useState(0);
  const [authStatus, setAuthStatus] = useState(false);

  // Load cart from local storage just to update the counter
  useEffect(() => {
    const handleStorage = () => {
      const cart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };

    const checkAuth = () => {
      setAuthStatus(!!localStorage.getItem('admin_token'));
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
    window.dispatchEvent(new Event('authStatusChanged'));
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
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--color-border)',
            zIndex: 100
          }}>
            <div className="container flex items-center justify-between" style={{ height: '80px' }}>
              <Link to="/" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '0.05em', fontFamily: '"Playfair Display", serif', color: '#b38122' }}>
                Marbilo
              </Link>
              <nav className="flex items-center gap-md">
                <a href="/#collection" style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>Collection</a>
                <Link to="/order" style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                  {cartCount > 0 && (
                    <span style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontSize: '0.75rem',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {cartCount}
                    </span>
                  )}
                </Link>
              </nav>
            </div>
          </header>
        } />
      </Routes>

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/order" element={<OrderPage />} />

          <Route path="/admin" element={authStatus ? <AdminLayout onLogout={handleLogout} /> : <AdminLogin />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="banners" element={<AdminBanners />} />
          </Route>
        </Routes>
      </main>

      {/* Footer - Hidden on admin routes */}
      <Routes>
        <Route path="/admin/*" element={null} />
        <Route path="*" element={
          <footer style={{ backgroundColor: 'var(--color-text-primary)', color: 'white', padding: 'var(--space-xl) 0', marginTop: 'auto' }}>
            <div className="container flex flex-col items-center gap-lg">
              <h2 style={{ fontSize: '2.5rem', letterSpacing: '0.05em', fontFamily: '"Playfair Display", serif' }}>Marbilo</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>Elegance redefined for the modern muse.</p>
              <div className="text-sm text-muted">
                &copy; {new Date().getFullYear()} Marbilo Boutique. All rights reserved. | <Link to="/admin">Admin Login</Link>
              </div>
            </div>
          </footer>
        } />
      </Routes>
    </>
  );
}

export default App;
