import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

export default function OrderPage() {
    const { addToast } = useToast();
    const [cart, setCart] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        shippingArea: '',
        address: '',
        orderNote: ''
    });
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);

    useEffect(() => {
        // Load cart from localStorage
        const savedCart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
        setCart(savedCart);
    }, []);

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = formData.shippingArea === 'Inside Dhaka' ? 60 : (formData.shippingArea === 'Outside Dhaka' ? 120 : 0);
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
        setPlacingOrder(true);

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: formData.name,
                    customerEmail: formData.email,
                    customerPhone: formData.phone,
                    shippingArea: formData.shippingArea,
                    customerAddress: formData.address,
                    orderNote: formData.orderNote,
                    totalAmount,
                    items: cart
                })
            });

            if (response.ok) {
                setOrderSuccess(true);
                setCart([]);
                localStorage.removeItem('shop_cart');
                window.dispatchEvent(new Event('cartUpdated'));
            } else {
                addToast('Failed to place order. Please try again.', 'error');
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
            <div className="container section text-center" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', color: 'var(--color-accent)' }}>Thank You</h1>
                <p style={{ fontSize: '1.25rem', marginBottom: 'var(--space-lg)' }}>Your elegant order has been placed successfully.</p>
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
                    <Link to="/" className="btn btn-primary">Discover Dresses</Link>
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
                                        <div style={{ fontWeight: 600 }}>৳{(item.price * item.quantity).toFixed(2)}</div>
                                    </div>
                                )
                            })}
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                                <span>Subtotal</span>
                                <span>৳{subtotal.toFixed(2)}</span>
                            </div>
                            {shippingCost > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                                    <span>Shipping ({formData.shippingArea})</span>
                                    <span>৳{shippingCost.toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
                                <span>Total</span>
                                <span>৳{totalAmount.toFixed(2)}</span>
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

                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                <div style={{ flex: 1 }}>
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
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="Email Address"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        style={{ width: '100%', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none', transition: 'border-color 0.2s' }}
                                        onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                    />
                                </div>
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
                                    <option value="Inside Dhaka">Inside Dhaka</option>
                                    <option value="Outside Dhaka">Outside Dhaka</option>
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
                                disabled={placingOrder}
                                style={{ marginTop: 'var(--space-sm)', width: '100%' }}
                            >
                                {placingOrder ? 'Processing...' : `Place Order • ৳${totalAmount.toFixed(2)}`}
                            </button>
                        </form>
                    </div>

                </div>
            )}
        </div>
    );
}
