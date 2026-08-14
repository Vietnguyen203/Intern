import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

// =========================================================
// CONFIRM DIALOG — UI thuần, được điều khiển bởi hook useConfirm
// =========================================================
export const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Xác nhận', danger = false }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
      onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 22, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px', padding: '28px 32px',
          minWidth: '340px', maxWidth: '440px', width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: danger ? '#fee2e2' : '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertCircle size={20} color={danger ? '#ef4444' : '#6366f1'} />
          </span>
          <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#1a1a2e' }}>{title}</h3>
        </div>
        <p style={{ fontSize: '14px', color: '#555', margin: '0 0 24px', lineHeight: '1.6' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#555' }}>
            Hủy bỏ
          </button>
          <button onClick={onConfirm}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', backgroundColor: danger ? '#ef4444' : '#6366f1', color: 'white' }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
