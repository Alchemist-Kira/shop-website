import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import notificationSoundFile from '../assets/notification-sound.mp3';

export default function AdminLayout({ onLogout }) {
    const location = useLocation();
    const { addToast } = useToast();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const audioRef = useRef(null);

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

    useEffect(() => {
        const soundEnabledRef = { current: true };
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.notification_sound_enabled === 'false') {
                    soundEnabledRef.current = false;
                }
            })
            .catch(err => console.error("Failed to fetch sound settings:", err));

        const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
        if (!token) return;

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // --- WEB PUSH SUBSCRIPTION ---
        const setupWebPush = async () => {
            if ('serviceWorker' in navigator && 'PushManager' in window && Notification.permission === 'granted') {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');

                    const keyRes = await fetch('/api/push/vapid-publicKey', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!keyRes.ok) return;
                    const { publicKey } = await keyRes.json();

                    const padding = '='.repeat((4 - publicKey.length % 4) % 4);
                    const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const applicationServerKey = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        applicationServerKey[i] = rawData.charCodeAt(i);
                    }

                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey
                    });

                    await fetch('/api/push/subscribe', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ subscription })
                    });
                } catch (err) {
                    console.error("Web Push setup failed:", err);
                }
            }
        };
        setupWebPush();

        const eventSource = new EventSource(`/api/orders/stream?token=${token}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.connected) return;

                // Broadcast the event so AdminDashboard can update its list if it's open
                window.dispatchEvent(new CustomEvent('new-admin-order', { detail: data }));
                addToast(`New order received from ${data.customerName}!`, 'success');

                if (soundEnabledRef.current && audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.error("Audio autoplay blocked:", e));
                }
            } catch (err) {
                console.error("SSE parse error", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error", err);
            eventSource.close();
        };

        return () => eventSource.close();
    }, [addToast]);

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F8F9FA', overflow: 'hidden' }}>
            {/* Hidden audio element for global notifications */}
            <audio ref={audioRef} src={notificationSoundFile} preload="auto" />

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
                    <Link to="/admin/settings" style={navStyle('/admin/settings')} onClick={closeSidebar}>Store Settings</Link>
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
