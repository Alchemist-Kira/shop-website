import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 'var(--space-xl)',
            backgroundColor: 'var(--color-bg-primary)'
        }}>
            <h1 style={{
                fontSize: '6rem',
                fontFamily: '"Playfair Display", serif',
                color: 'var(--color-accent)',
                margin: '0 0 var(--space-md) 0',
                lineHeight: 1
            }}>404</h1>
            <h2 style={{
                fontSize: '2rem',
                marginBottom: 'var(--space-md)',
                color: 'var(--color-text-primary)'
            }}>Page Not Found</h2>
            <p style={{
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-xl)',
                maxWidth: '500px'
            }}>
                We couldn't find the page you were looking for. It might have been removed, renamed, or didn't exist in the first place.
            </p>
            <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Return to Home
            </Link>
        </div>
    );
}
