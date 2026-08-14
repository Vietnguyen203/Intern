import { useState, useCallback, useRef } from 'react';

// Hook giữ state + logic của hệ thống toast. Component hiển thị thật (ToastContainer)
// nằm ở shared/components/ToastContainer.jsx — hook không biết gì về JSX.
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timerRef = useRef({});

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timerRef.current[id]);
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    timerRef.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur || 5000),
    info: (msg, dur) => show(msg, 'info', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
  };

  return { toasts, toast, remove };
};
