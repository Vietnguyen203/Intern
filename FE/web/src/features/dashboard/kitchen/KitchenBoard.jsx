import { Utensils, Users, CheckCircle } from 'lucide-react';
import { KDS_SETTINGS_DEFAULT } from './kitchenUtils';
import { KitchenTicket } from './KitchenTicket';

export const KitchenBoard = ({ items, viewMode, kiosk, now, onStatusChange, onCompleteAll, onPrint, onCancelOrder, thresholds = KDS_SETTINGS_DEFAULT, cookStartMap }) => {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: kiosk ? '120px 40px' : '80px', color: 'var(--text-secondary)' }}>
        <Utensils size={kiosk ? 72 : 52} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
        <p style={{ fontWeight: '600', fontSize: kiosk ? '22px' : '16px' }}>Không có món nào cần chế biến</p>
        <p style={{ fontSize: kiosk ? '16px' : '13px', marginTop: '4px' }}>Tất cả đơn đã được phục vụ hoặc chưa có đơn mới.</p>
      </div>
    );
  }

  if (viewMode === 'status') {
    const columns = [
      { key: 'PENDING', label: '⏳ Chờ', color: 'var(--accent-pending)' },
      { key: 'COOKING', label: '🔥 Đang nấu', color: 'var(--accent-cooking)' },
      { key: 'READY', label: '✅ Sẵn sàng', color: 'var(--accent-ready)' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: kiosk ? '20px' : '16px' }}>
        {columns.map(col => {
          const colItems = items.filter(i => i.kitchenStatus === col.key)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return (
            <div key={col.key} style={{ backgroundColor: 'var(--bg-app)', borderRadius: '14px', padding: kiosk ? '16px' : '12px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <h4 style={{ fontSize: kiosk ? '20px' : '15px', fontWeight: '800', color: col.color, margin: 0 }}>{col.label}</h4>
                <span style={{ fontSize: kiosk ? '16px' : '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>{colItems.length}</span>
              </div>
              {colItems.map(item => (
                <KitchenTicket key={item.id} item={item} now={now} kiosk={kiosk} onStatusChange={onStatusChange} onPrint={onPrint} onCancelOrder={onCancelOrder} thresholds={thresholds} cookStartMap={cookStartMap} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // viewMode === 'table' (mặc định) — nhóm theo bàn, bàn nào gọi món sớm nhất lên đầu
  const groups = Object.entries(
    items.reduce((acc, item) => {
      const key = item.tableNumber || 'Mang về';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {})
  ).sort((a, b) => {
    const timeA = Math.min(...a[1].map(i => new Date(i.createdAt).getTime()));
    const timeB = Math.min(...b[1].map(i => new Date(i.createdAt).getTime()));
    return timeA - timeB;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${kiosk ? 420 : 350}px, 1fr))`, gap: kiosk ? '28px' : '24px' }}>
      {groups.map(([tableName, tItems]) => (
        <div key={tableName} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: kiosk ? '20px 24px' : '16px 20px', backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: kiosk ? '44px' : '36px', height: kiosk ? '44px' : '36px', borderRadius: '10px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Users size={kiosk ? 22 : 18} />
              </div>
              <h4 style={{ fontSize: kiosk ? '24px' : '18px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>{tableName}</h4>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: kiosk ? '14px' : '12px', fontWeight: '700', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-app)', padding: '4px 10px', borderRadius: '20px' }}>
                {tItems.length} món
              </span>
              {tItems.some(i => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'COOKING') && (
                <button onClick={() => onCompleteAll(tItems)}
                  style={{ padding: kiosk ? '10px 16px' : '6px 12px', fontSize: kiosk ? '15px' : '12px', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--btn-ready)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                  <CheckCircle size={kiosk ? 18 : 14} /> Xong tất cả
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: kiosk ? '20px 24px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...tItems].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(item => (
              <KitchenTicket key={item.id} item={item} now={now} kiosk={kiosk} onStatusChange={onStatusChange} onPrint={onPrint} onCancelOrder={onCancelOrder} thresholds={thresholds} cookStartMap={cookStartMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
