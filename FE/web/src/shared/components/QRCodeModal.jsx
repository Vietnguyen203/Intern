import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X } from 'lucide-react';

export const QRCodeModal = ({ table, onClose }) => {
  const [hostIp, setHostIp] = useState(() => {
    return window.location.hostname === 'localhost' ? '192.168.1.4:5173' : window.location.host;
  });

  if (!table) return null;
  const qrUrl = `http://${hostIp}/customer?tableId=${table.id || table.ID}&tableName=${table.tableNumber}`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div className="modal-header">
          <h3>Mã QR Đặt Món - Bàn {table.tableNumber}</h3>
          <button className="btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          {window.location.hostname === 'localhost' && (
            <details style={{ marginBottom: '20px', textAlign: 'left', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
              <summary style={{ fontSize: '13px', color: '#64748B', fontWeight: '600', userSelect: 'none' }}>⚙️ Cài đặt IP mạng LAN (Nâng cao)</summary>
              <div style={{ marginTop: '12px', cursor: 'default' }}>
                <input
                  type="text"
                  value={hostIp}
                  onChange={(e) => setHostIp(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: '12px', color: '#EF4444', margin: '8px 0 0 0', fontWeight: '500' }}>
                  *Chỉ thay đổi nếu điện thoại khách hàng báo lỗi kết nối. Hãy điền IP LAN thực tế của máy tính này.
                </p>
              </div>
            </details>
          )}
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>Khách hàng quét mã QR này bằng điện thoại để tự xem Menu và đặt món.</p>
          <div style={{ backgroundColor: 'white', padding: '16px', display: 'inline-block', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <QRCodeCanvas
              value={qrUrl}
              size={250}
              level={"H"}
              includeMargin={false}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => window.open(qrUrl, '_blank')}
            >
              Mở Trang khách
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
