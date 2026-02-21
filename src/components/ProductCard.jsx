import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product }) {
    const [hovered, setHovered] = useState(false);
    const navigate = useNavigate();

    // Create a URL-safe slug from the product name
    const slug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    return (
        <div
            onClick={() => navigate(`/product/${product.id}-${slug}`)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: 'var(--color-bg-secondary)',
                boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                transition: 'var(--transition-normal)',
                transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
                cursor: 'pointer'
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden' }}>
                <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.5s ease',
                        transform: hovered ? 'scale(1.05)' : 'scale(1)'
                    }}
                />
                {product.stock <= 3 && product.stock > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: '#ffefeb',
                        color: '#d9381e',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600
                    }}>
                        Only {product.stock} left!
                    </div>
                )}
                {product.stock === 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: 'var(--color-text-primary)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600
                    }}>
                        Sold Out
                    </div>
                )}
            </div>

            <div style={{ padding: 'var(--space-md)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '4px',
                        width: '100%'
                    }}>
                        {product.name}
                    </h3>
                    <span style={{ fontWeight: 600, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>৳{product.price.toFixed(2)}</span>
                </div>
                <button
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: hovered ? 'var(--color-text-primary)' : 'var(--color-surface-dim)',
                        color: hovered ? 'white' : 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        transition: 'var(--transition-normal)',
                        cursor: 'pointer'
                    }}
                >
                    View Details
                </button>
            </div>
        </div>
    );
}
