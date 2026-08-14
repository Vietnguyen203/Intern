import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ---------------------------------------------------------
// Màn chào ngắn (~1.8s) hiện đúng 1 lần ngay sau khi có currentUser (đăng nhập mới hoặc khôi phục
// phiên từ token lưu sẵn) — trước khi vào Dashboard thật.
// ---------------------------------------------------------
const STAFF_ROLE_LABELS = { ADMIN: 'Quản trị viên', WAITER: 'Phục vụ', KITCHEN: 'Bếp', CHEF: 'Bếp trưởng', GUEST: 'Khách' };

export const WelcomeSplash = ({ user }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const roleLabel = STAFF_ROLE_LABELS[user?.role] || user?.role || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'linear-gradient(135deg, #11117F 0%, #1E3A8A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', textAlign: 'center', padding: '24px'
      }}
    >
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease'
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8, fontWeight: '700', letterSpacing: '1px' }}>NHÀ HÀNG FOOD</p>
        <h1 style={{ margin: '0 0 10px', fontSize: '30px', fontWeight: '800' }}>Chào mừng, {user?.fullName || user?.username}! 👋</h1>
        {roleLabel && <p style={{ margin: 0, fontSize: '15px', opacity: 0.85 }}>{roleLabel} — đang vào hệ thống...</p>}
      </div>
    </motion.div>
  );
};
