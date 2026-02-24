import { useState, useEffect, useMemo } from 'react';
import { useToast } from '../components/ToastProvider';

export default function AdminDashboard() {
    const { addToast } = useToast();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                addToast(`Order marked as ${newStatus}`, 'success');
            } else {
                addToast('Failed to update status', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Error updating status', 'error');
        }
    };



    const filteredAndSortedOrders = useMemo(() => {
        let result = [...orders];

        // Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.id.toString().includes(query) ||
                (o.customerName && o.customerName.toLowerCase().includes(query)) ||
                (o.customerPhone && o.customerPhone.includes(query)) ||
                (o.customerEmail && o.customerEmail.toLowerCase().includes(query))
            );
        }

        // Status Filter
        if (filterStatus !== 'all') {
            result = result.filter(o => o.status === filterStatus);
        }

        // Sort
        if (sortBy === 'newest') {
            result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sortBy === 'oldest') {
            result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return result;
    }, [orders, filterStatus, sortBy, searchQuery]);

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm("Are you sure you want to delete this order? This cannot be undone.")) return;

        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setOrders(orders.filter(o => o.id !== orderId));
                addToast('Order deleted successfully', 'success');
            } else {
                const data = await res.json();
                addToast(data.error || 'Failed to delete order', 'error');
            }
        } catch (err) {
            addToast('Error deleting order', 'error');
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm("Are you sure you want to permanently delete ALL completed and cancelled orders? Pending orders will be kept.")) return;

        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch(`/api/orders`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setOrders(orders.filter(o => o.status === 'pending'));
                addToast('Order history cleared successfully', 'success');
            } else {
                addToast('Failed to clear order history', 'error');
            }
        } catch (err) {
            addToast('Error clearing order history', 'error');
        }
    };

    const fetchOrders = () => {
        const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
        fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => {
                if (!res.ok) throw new Error('Unauthorized');
                return res.json();
            })
            .then(data => {
                setOrders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch orders:', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchOrders();

        // Listen for new orders broadcasted by AdminLayout
        const handleNewOrder = (event) => {
            const newOrder = event.detail;
            setOrders(prev => [newOrder, ...prev]);
        };

        window.addEventListener('new-admin-order', handleNewOrder);

        return () => {
            window.removeEventListener('new-admin-order', handleNewOrder);
        };
    }, []);

    const handlePrint = (order) => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            addToast("Please allow popups to print receipts.", 'error');
            return;
        }

        const itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 500;">${item.name}</div>
                    ${(item.selectedSize || item.selectedColor) ? `<div style="font-size: 12px; color: #666;">${item.selectedSize ? 'Size: ' + item.selectedSize : ''} ${item.selectedColor ? '| Color: ' + item.selectedColor : ''}</div>` : ''}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${(item.quantity * item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></td>
            </tr>
        `).join('');

        const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = order.totalAmount - subtotal;

        printWindow.document.write(`
            <html>
            <head>
                <title>Receipt - Order #${order.id.toString().padStart(4, '0')}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; color: #111; line-height: 1.5; padding: 40px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .header h1 { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 0.05em; font-family: 'Playfair Display', serif; color: #1a1a1a; }
                    .header p { margin: 4px 0 0; color: #666; text-transform: uppercase; font-size: 14px; letter-spacing: 2px; }
                    .info-grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .info-block { flex: 1; }
                    .info-block h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
                    .info-block p { margin: 0; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    th { text-align: left; padding: 12px; background: #f8f9fa; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
                    th.right { text-align: right; }
                    th.center { text-align: center; }
                    .totals { width: 300px; margin-left: auto; }
                    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
                    .totals-row.bold { font-weight: 700; font-size: 18px; border-top: 2px solid #111; padding-top: 12px; margin-top: 4px; }
                    .footer { text-align: center; margin-top: 60px; font-size: 14px; color: #666; padding-top: 20px; border-top: 1px solid #eee; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Marbilo</h1>
                    <p>Luxury Panjabi</p>
                </div>

                <div class="info-grid">
                    <div class="info-block">
                        <h3>Billed To</h3>
                        <p><strong>${order.customerName}</strong><br>
                        ${order.customerEmail}<br>
                        ${order.customerPhone ? order.customerPhone + '<br>' : ''}
                        ${order.customerAddress}</p>
                    </div>
                    <div class="info-block" style="text-align: right;">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> #${order.id.toString().padStart(4, '0')}<br>
                        <strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}<br>
                        <strong>Payment:</strong> Cash on Delivery (COD)</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th class="center">Qty</th>
                            <th class="right">Unit Price</th>
                            <th class="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-row">
                        <span>Subtotal</span>
                        <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                    </div>
                    ${shippingCost > 0 ? (
                '<div class="totals-row">' +
                '<span>Shipping (' + order.shippingArea + ')</span>' +
                '<span>' + shippingCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' <strong>৳</strong></span>' +
                '</div>'
            ) : ''}
                    <div class="totals-row bold">
                        <span>Total (COD)</span>
                        <span>${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                    </div>
                </div>

                <div class="footer">
                    Thank you for shopping with Marbilo!<br>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        // Slight delay to ensure styles apply
        setTimeout(() => {
            printWindow.print();
            // Optional: printWindow.close(); after printing, but browsers handle this differently.
        }, 250);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Order Management</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Search orders (ID, Name, Phone)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none', width: '250px' }}
                    />
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none' }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', outline: 'none' }}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>

                    <button
                        onClick={handleClearHistory}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ffefeb',
                            color: '#d9381e',
                            border: '1px solid #ffc1b5',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Clear History
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-muted">Loading orders...</div>
            ) : filteredAndSortedOrders.length === 0 ? (
                <div style={{ padding: 'var(--space-xl)', backgroundColor: 'white', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No orders match your criteria.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {filteredAndSortedOrders.map(order => (
                        <div key={order.id} style={{
                            backgroundColor: 'white',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-sm)',
                            padding: 'var(--space-lg)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Order #{order.id.toString().padStart(4, '0')}</h3>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                        Placed on: {new Date(order.createdAt + 'Z').toLocaleDateString()} at {new Date(order.createdAt + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-accent)' }}>{order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            backgroundColor: order.status === 'pending' ? '#fff3cd' : (order.status === 'confirmed' ? '#d1e7dd' : '#f8d7da'),
                                            color: order.status === 'pending' ? '#664d03' : (order.status === 'confirmed' ? '#0f5132' : '#842029'),
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                        {order.status !== 'confirmed' && (
                                            <button onClick={() => handleUpdateStatus(order.id, 'confirmed')} style={{ padding: '6px 12px', border: '1px solid #198754', backgroundColor: '#198754', color: 'white', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
                                        )}
                                        {order.status !== 'cancelled' && (
                                            <button onClick={() => handleUpdateStatus(order.id, 'cancelled')} style={{ padding: '6px 12px', border: '1px solid #dc3545', backgroundColor: 'transparent', color: '#dc3545', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                        )}
                                    </div>
                                    {order.status === 'confirmed' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                            <button onClick={() => handlePrint(order)} style={{ padding: '8px 16px', border: 'none', backgroundColor: 'var(--color-text-primary)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                                Print Receipt
                                            </button>
                                        </div>
                                    )}
                                    {order.status === 'pending' && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Confirm order to print receipt</div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                                <div>
                                    <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>Customer Details</h4>
                                    <div style={{ fontWeight: 500 }}>{order.customerName}</div>
                                    {order.customerPhone && <div><a href={`tel:${order.customerPhone}`} style={{ color: 'var(--color-text-primary)' }}>{order.customerPhone}</a></div>}
                                    <div><a href={`mailto:${order.customerEmail}`} style={{ color: 'var(--color-accent)' }}>{order.customerEmail}</a></div>

                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Shipping Area: {order.shippingArea || 'N/A'}</div>
                                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                                            {order.customerAddress}
                                        </div>
                                    </div>

                                    {order.orderNote && (
                                        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', backgroundColor: 'var(--color-surface-dim)', borderRadius: 'var(--radius-sm)' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Order Note</div>
                                            <div style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>{order.orderNote}</div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>Order Items</h4>
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {order.items.map((item, idx) => (
                                            <li key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 0', borderBottom: idx !== order.items.length - 1 ? '1px dashed var(--color-border)' : 'none' }}>
                                                {item.imageUrl && (
                                                    <img src={item.imageUrl} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>
                                                        {item.productId ? (
                                                            <a
                                                                href={`/product/${item.productId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--color-text-primary)', textDecoration: 'none', borderBottom: '1px solid transparent' }}
                                                                onMouseEnter={e => e.currentTarget.style.borderBottom = '1px solid var(--color-accent)'}
                                                                onMouseLeave={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
                                                            >
                                                                {item.name}
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                                                {item.name} (Product Deleted)
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Variant Details */}
                                                    {(item.selectedSize || item.selectedColor) && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                                            {item.selectedSize && <span>Size: <span style={{ fontWeight: 600 }}>{item.selectedSize}</span></span>}
                                                            {item.selectedColor && <span>Color: <span style={{ fontWeight: 600 }}>{item.selectedColor}</span></span>}
                                                        </div>
                                                    )}

                                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Qty: {item.quantity} × {Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></div>
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></div>
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-md)', padding: 'var(--space-sm) 0', borderTop: '1px solid var(--color-border)' }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Delivery Charge</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>{(order.totalAmount - order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            {order.status !== 'pending' && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-surface-dim)' }}>
                                    <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '8px 16px', border: '1px solid #dc3545', backgroundColor: '#fff', color: '#dc3545', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dc3545'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#dc3545'; }}>
                                        Delete Order
                                    </button>
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
