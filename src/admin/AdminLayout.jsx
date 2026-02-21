import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

export default function AdminLayout({ onLogout }) {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const navStyle = (path) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: location.pathname === path ? 'rgba(0,0,0,0.05)' : 'transparent',
        color: location.pathname === path ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontWeight: location.pathname === path ? 600 : 400,
        transition: 'background-color 0.2s, color 0.2s',
    });

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F8F9FA', overflow: 'hidden' }}>

            {/* Mobile Overlay */}
            <div
                className={`admin-overlay ${isSidebarOpen ? 'open' : ''}`}
                onClick={closeSidebar}
            ></div>

            {/* Sidebar */}
            <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`} style={{
                flexShrink: 0,
                backgroundColor: 'white',
                borderRight: '1px solid var(--color-border)',
                padding: 'var(--space-lg) var(--space-md)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto'
            }}>
                <div style={{ marginBottom: 'var(--space-xl)', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '1.75rem', letterSpacing: '0.05em', fontWeight: 700, fontFamily: '"Playfair Display", serif' }}>Marbilo <span style={{ color: 'var(--color-accent)', fontWeight: 400, fontFamily: 'Inter, sans-serif', fontSize: '1.25rem' }}>Admin</span></h1>
                    <button className="admin-mobile-header" onClick={closeSidebar} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
                    <Link to="/admin" style={navStyle('/admin')} onClick={closeSidebar}>Dashboard / Orders</Link>
                    <Link to="/admin/products" style={navStyle('/admin/products')} onClick={closeSidebar}>Inventory Management</Link>
                    <Link to="/admin/banners" style={navStyle('/admin/banners')} onClick={closeSidebar}>Manage Banners</Link>
                </nav>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={onLogout} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        color: '#d9381e',
                        fontSize: '0.875rem',
                        textAlign: 'left',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background-color 0.2s',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                        onMouseEnter={e => e.target.style.backgroundColor = 'rgba(217, 56, 30, 0.05)'}
                        onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                    >
                        Sign Out
                    </button>
                    <Link to="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.875rem'
                    }}>
                        &larr; Return to Storefront
                    </Link>
                </div>
            </aside >

            {/* Main Content Area */}
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Mobile Header Bar */}
                <div className="admin-mobile-header" style={{ padding: '1rem', backgroundColor: 'white', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Marbilo Admin</h2>
                </div>

                {/* Router Outlet Scrollable Area */}
                <div className="admin-content-area">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
