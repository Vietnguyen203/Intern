import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

// Hook giữ state của hộp thoại xác nhận dùng chung toàn app.
// confirm(title, message) trả về Promise<boolean> — dùng: `if (await confirm(...)) { ... }`.
export const useConfirm = () => {
  const [state, setState] = useState({ open: false, title: '', message: '', danger: false, confirmLabel: 'Xác nhận', resolve: null });

  const confirm = useCallback((title, message, { danger = false, confirmLabel = 'Xác nhận' } = {}) => {
    return new Promise(resolve => {
      setState({ open: true, title, message, danger, confirmLabel, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  const ConfirmUI = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      danger={state.danger}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmUI };
};
