import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertCircle, X } from 'lucide-react';

// =========================================================
// TOAST NOTIFICATION SYSTEM — UI thuần, nhận toasts/onRemove từ hook useToast
// =========================================================
export const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: 'fixed', top: '20px', right: '20px',
    zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px',
    pointerEvents: 'none'
  }}>
    <AnimatePresence>
      {toasts.map(t => {
        const cfg = {
          success: { bg: '#10b981', icon: <CheckCircle size={18} />, label: 'Thành công' },
          error: { bg: '#ef4444', icon: <XCircle size={18} />, label: 'Lỗi' },
          info: { bg: '#6366f1', icon: <Info size={18} />, label: 'Thông báo' },
          warning: { bg: '#f59e0b', icon: <AlertCircle size={18} />, label: 'Cảnh báo' },
        }[t.type] || { bg: '#6366f1', icon: <Info size={18} />, label: '' };
        return (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.85 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              pointerEvents: 'all',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: 'white', borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)', padding: '14px 16px',
              minWidth: '280px', maxWidth: '360px',
              borderLeft: `4px solid ${cfg.bg}`,
            }}>
            <span style={{ color: cfg.bg, flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 2px', color: '#1a1a2e' }}>{cfg.label}</p>
              <p style={{ fontSize: '13px', color: '#555', margin: 0, wordBreak: 'break-word' }}>{t.message}</p>
            </div>
            <button onClick={() => onRemove(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '0', flexShrink: 0 }}>
              <X size={15} />
            </button>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);
