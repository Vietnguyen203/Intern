import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';

// Danh sách các lượt khách tự đặt bàn trước (qua /customer?entry=guest -> "Đặt bàn trước theo giờ").
// Mirror cấu trúc modal-overlay/modal-content của QRCodeModal.jsx. Chỉ fetch khi mở (không tự
// refresh theo STOMP như bảng Table Status — nút "Làm mới" đủ dùng cho việc quản lý ít khi cần gấp).
export const ReservationsPanel = ({ open, onClose }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReservations = () => {
    setLoading(true);
    setError('');
    apiService.dashboard.getReservations()
      .then(res => {
        const list = (res.data || res || []).filter(r => r.status === 'CONFIRMED');
        list.sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt));
        setReservations(list);
      })
      .catch(err => setError('Không tải được danh sách đặt bàn: ' + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) fetchReservations();
  }, [open]);

  if (!open) return null;

  const handleCancel = async (id) => {
    if (!window.confirm('Huỷ lượt đặt bàn này?')) return;
    try {
      await apiService.dashboard.cancelReservation(id);
      fetchReservations();
    } catch (err) {
      alert('Huỷ thất bại: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3>📅 Đặt bàn trước</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn-ghost" onClick={fetchReservations} title="Làm mới"><RefreshCw size={18} /></button>
            <button className="btn-ghost" onClick={onClose}><X size={20} /></button>
          </div>
        </div>
        <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Đang tải...</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#ef4444', padding: '20px' }}>{error}</p>
          ) : reservations.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Chưa có lượt đặt bàn nào sắp tới.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {reservations.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '14px', color: '#11117F' }}>
                      Bàn {r.tableNumber} — {r.partySize} khách
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(r.reservedAt).toLocaleString('vi-VN')} · {r.customerName} · {r.customerPhone}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancel(r.id)}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Huỷ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
