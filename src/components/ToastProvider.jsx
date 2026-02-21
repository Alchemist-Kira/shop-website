import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 9999,
                pointerEvents: 'none'
            }}>
                {toasts.map(toast => (
                    <div key={toast.id} style={{
                        backgroundColor: toast.type === 'error' ? '#dc3545' : (toast.type === 'success' ? '#198754' : 'var(--color-text-primary)'),
                        color: 'white',
                        padding: '12px 20px',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minWidth: '250px',
                        pointerEvents: 'auto',
                        animation: 'slideIn 0.3s ease forwards'
                    }}>
                        <span>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                marginLeft: '12px',
                                padding: '4px'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
