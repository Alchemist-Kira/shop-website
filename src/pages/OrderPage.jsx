import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { useToast } from '../components/ToastProvider';

export default function OrderPage() {
    const { addToast } = useToast();
    const [cart, setCart] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        shippingArea: '',
        address: '',
        orderNote: ''
    });
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [settings, setSettings] = useState({ delivery_inside: '60', delivery_outside: '120' });

    useEffect(() => {
        if (orderSuccess) {
            window.scrollTo(0, 0);
        }
    }, [orderSuccess]);

    useEffect(() => {
        // Load cart from localStorage
        const savedCart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
        setCart(savedCart);

        // Fetch current store settings for delivery charges
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.delivery_inside || data.delivery_outside) {
                    setSettings({
                        delivery_inside: data.delivery_inside || '60',
                        delivery_outside: data.delivery_outside || '120'
                    });
                }
            })
            .catch(err => console.error("Failed to fetch settings:", err));
    }, []);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = formData.shippingArea === 'Inside Dhaka' ? parseFloat(settings.delivery_inside) : (formData.shippingArea === 'Outside Dhaka' ? parseFloat(settings.delivery_outside) : 0);
    const totalAmount = subtotal + shippingCost;

    const handleRemove = (productId, selectedSize, selectedColor) => {
        const newCart = cart.filter(item =>
            !(item.productId === productId && item.selectedSize === selectedSize && item.selectedColor === selectedColor)
        );
        setCart(newCart);
        localStorage.setItem('shop_cart', JSON.stringify(newCart));
        window.dispatchEvent(new Event('cartUpdated'));
    };

    const updateQuantity = (productId, selectedSize, selectedColor, delta) => {
        const newCart = cart.map(item => {
            if (item.productId === productId && item.selectedSize === selectedSize && item.selectedColor === selectedColor) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0);

        setCart(newCart);
        localStorage.setItem('shop_cart', JSON.stringify(newCart));
        window.dispatchEvent(new Event('cartUpdated'));
    };

    const handleCheckout = async (e) => {
        e.preventDefault();

        // Validate BD phone number (relaxed prefix for testing purposes)
        const phoneRegex = /^(?:\+880|880|0)?1\d{9}$/;
        if (!phoneRegex.test(formData.phone.replace(/[\s-]/g, ''))) {
            addToast('Please enter a valid 11-digit phone number.', 'error');
            return;
        }

        setPlacingOrder(true);

        try {
            const orderPayload = {
                customerName: formData.name,
                customerEmail: '', // Optional/Legacy support, ensuring it's not null for schema constraints
                customerPhone: formData.phone,
                shippingArea: formData.shippingArea,
                customerAddress: formData.address,
                orderNote: formData.orderNote,
                totalAmount,
                items: cart
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            const result = await response.json();

            if (response.ok) {
                // Track successful purchase
                ReactGA.event('purchase', {
                    transaction_id: `ORD_${Date.now()}`,
                    value: totalAmount,
                    currency: 'BDT',
                    items: cart.map(item => ({
                        item_id: item.productId,
                        item_name: item.name,
                        item_variant: item.selectedSize + (item.selectedColor ? `, ${item.selectedColor}` : ''),
                        price: item.price,
                        quantity: item.quantity
                    }))
                });

                setOrderSuccess(true);
                setCart([]);
                localStorage.removeItem('shop_cart');
                window.dispatchEvent(new Event('cartUpdated'));
            } else {
                addToast(result.error || 'Failed to place order. Please try again.', 'error');
                if (result.details) console.error('Order Error Details:', result.details);
            }
        } catch (err) {
            console.error(err);
            addToast('Network error. Please try again later.', 'error');
        } finally {
            setPlacingOrder(false);
        }
    };

    if (orderSuccess) {
        return (
            <div className="container section text-center" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', color: 'var(--color-accent)' }}>Thank You</h1>
                <p style={{ fontSize: '1.25rem', marginBottom: 'var(--space-lg)', lineHeight: '1.8' }}>
                    Your Marbilo order has been placed successfully.<br />
                    <span style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>We will contact you shortly to confirm your order.</span>
                </p>
                <Link to="/" className="btn btn-primary">Continue Shopping</Link>
            </div>
        );
    }

    return (
        <div className="container section">
            <h1 className="text-center" style={{ marginBottom: 'var(--space-xl)', fontSize: '2.5rem' }}>Checkout</h1>

            {cart.length === 0 ? (
                <div className="text-center">
                    <p style={{ marginBottom: 'var(--space-lg)', fontSize: '1.25rem' }}>Your cart is empty.</p>
                    <Link to="/" className="btn btn-primary">Discover Panjabis</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg" style={{ alignItems: 'start' }}>

                    {/* Cart Summary */}
                    <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ marginBottom: 'var(--space-md)', fontSize: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>Order Summary</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                            {cart.map((item) => {
                                const itemKey = `${item.productId}-${item.selectedSize}-${item.selectedColor}`;
                                return (
                                    <div key={itemKey} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                                        <img src={item.imageUrl} alt={item.name} style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                        <div style={{ flexGrow: 1 }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 500 }}>{item.name}</h3>

                                            {(item.selectedSize || item.selectedColor) && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                    {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                                                    {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <button
                                                        onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, -1)}
                                                        style={{ width: '28px', height: '28px', backgroundColor: 'var(--color-surface-dim)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
                                                    >−</button>
                                                    <span style={{ width: '32px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500 }}>{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, 1)}
                                                        style={{ width: '28px', height: '28px', backgroundColor: 'var(--color-surface-dim)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
                                                    >+</button>
                                                </div>

                                                <button
                                                    onClick={() => handleRemove(item.productId, item.selectedSize, item.selectedColor)}
                                                    style={{ color: '#d9381e', fontSize: '0.75rem', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 600 }}>{(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></div>
                                    </div>
                                )
                            })}
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                                <span>{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                            </div>
                            {shippingCost > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Shipping ({formData.shippingArea})</span>
                                    <span>{shippingCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '1.125rem' }}>
                                <span>Total</span>
                                <span>{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Checkout Form */}
                    <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                        <h2 style={{ marginBottom: 'var(--space-md)', fontSize: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>Shipping Details</h2>
                        <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Phone</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="01XXXXXXXXX"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Shipping Area</label>
                                <select
                                    required
                                    value={formData.shippingArea}
                                    onChange={e => setFormData({ ...formData, shippingArea: e.target.value })}
                                    style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'white' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                >
                                    <option value="" disabled>Select Delivery Area</option>
                                    <option value="Inside Dhaka">Inside Dhaka ({settings.delivery_inside} ৳)</option>
                                    <option value="Outside Dhaka">Outside Dhaka ({settings.delivery_outside} ৳)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Full Address</label>
                                <textarea
                                    required
                                    placeholder="Street address Line 1"
                                    rows="2"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s', resize: 'vertical' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                            </div>

                            {/* Payment Method - Read Only */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Payment Method</label>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '16px',
                                    border: '1px solid var(--color-primary)',
                                    backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)',
                                    borderRadius: 'var(--radius-sm)'
                                }}>
                                    <input type="radio" checked readOnly style={{ accentColor: 'var(--color-primary)', transform: 'scale(1.2)' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Cash on Delivery (COD)</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Pay with cash upon delivery.</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Order Note (Optional)</label>
                                <textarea
                                    placeholder="Order Note"
                                    rows="2"
                                    value={formData.orderNote}
                                    onChange={e => setFormData({ ...formData, orderNote: e.target.value })}
                                    style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s', resize: 'vertical' }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={cart.length === 0 || placingOrder}
                                style={{ marginTop: 'var(--space-sm)', width: '100%' }}
                            >
                                {placingOrder ? 'Processing...' : <span>Place Order &bull; {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <strong>৳</strong></span>}
                            </button>
                        </form>
                    </div>

                </div>
            )}
        </div>
    );
}
