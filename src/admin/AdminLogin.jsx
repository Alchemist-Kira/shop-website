import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                // Dispatch event so layout can update
                window.dispatchEvent(new Event('authStatusChanged'));
                navigate('/admin');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-bg-primary)',
            padding: 'var(--space-md)'
        }}>
            <div style={{
                backgroundColor: 'var(--color-bg-secondary)',
                padding: 'var(--space-xl)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                    <h1 style={{ fontSize: '2.5rem', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 'var(--space-xs)', fontFamily: '"Playfair Display", serif' }}>Marbilo</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Admin Authentication</p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#ffefeb',
                        color: '#d9381e',
                        padding: 'var(--space-sm)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: 'var(--space-md)',
                        fontSize: '0.875rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-text-primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginTop: 'var(--space-sm)' }}
                    >
                        {loading ? 'Authenticating...' : 'Secure Login'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
                    <a href="/" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>&larr; Back to Boutique</a>
                </div>
            </div>
        </div>
    );
}
