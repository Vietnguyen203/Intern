import { KitchenBoard } from './KitchenBoard';
import { printKitchenTicket } from './kitchenUtils';

// Component UI của tab Bếp — nhận toàn bộ state/handler từ hook useKitchen qua props,
// tự nó không gọi API, không giữ state (ngoại trừ style/JSX thuần).
// Chế độ Kiosk KHÔNG còn là overlay trong cùng tab nữa — `onEnterKiosk` giờ mở
// KitchenKioskPage ở 1 tab/cửa sổ riêng (xem App.jsx), để có thể kéo sang màn hình/TV
// gắn cố định trong bếp mà không chiếm tab đang thao tác.
export const KitchenTab = ({
  active,
  kitchenItems, visibleKitchenItems, kitchenCategoryOptions,
  kitchenViewMode, setKitchenViewMode,
  kitchenCategoryFilter, setKitchenCategoryFilter,
  loading, timeTicker, kdsSettings, cookStartMap,
  onStatusChange, onCompleteAll, onCancelOrder,
  onRefresh, onEnterKiosk,
  canProposeFood, onProposeFood,
}) => {
  const counts = (
    <>
      {kitchenItems.filter(i => i.kitchenStatus === 'PENDING').length} chờ &middot;{' '}
      {kitchenItems.filter(i => i.kitchenStatus === 'COOKING').length} đang nấu &middot;{' '}
      {kitchenItems.filter(i => i.kitchenStatus === 'READY').length} sẵn sàng
    </>
  );

  const categoryFilterBar = (kiosk) => kitchenCategoryOptions.length > 1 && (
    <div style={{ display: 'flex', gap: kiosk ? '10px' : '8px', flexWrap: 'wrap', marginBottom: kiosk ? '20px' : '16px' }}>
      {kitchenCategoryOptions.map(cat => (
        <button key={cat} onClick={() => setKitchenCategoryFilter(cat)}
          style={{
            padding: kiosk ? '10px 18px' : '6px 14px', fontSize: kiosk ? '15px' : '12px', fontWeight: '700', borderRadius: '20px',
            border: `${kiosk ? 2 : 1}px solid ${kitchenCategoryFilter === cat ? 'var(--primary)' : 'var(--border-color)'}`,
            backgroundColor: kitchenCategoryFilter === cat ? 'var(--primary)' : 'var(--bg-surface)',
            color: kitchenCategoryFilter === cat ? '#FFF' : 'var(--text-primary)', cursor: 'pointer',
          }}>
          {cat === 'ALL' ? 'Tất cả khu' : cat}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* KITCHEN TAB */}
      {active && (
        <div>
          <style>{`
            @keyframes kdsPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35); }
              50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>🍳 Bếp — Đơn cần chế biến</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{counts}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setKitchenViewMode('table')}
                  style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'table' ? 'var(--primary)' : 'var(--bg-surface)', color: kitchenViewMode === 'table' ? '#FFF' : 'var(--text-primary)' }}>
                  🗂️ Theo bàn
                </button>
                <button onClick={() => setKitchenViewMode('status')}
                  style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'status' ? 'var(--primary)' : 'var(--bg-surface)', color: kitchenViewMode === 'status' ? '#FFF' : 'var(--text-primary)' }}>
                  📊 Theo trạng thái
                </button>
              </div>
              {canProposeFood && (
                <button onClick={onProposeFood} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>💡 Đề xuất món mới</button>
              )}
              <button onClick={onEnterKiosk} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>🖥️ Chế độ Kiosk (mở tab mới)</button>
              <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>🔄 Làm mới</button>
            </div>
          </div>

          {categoryFilterBar(false)}

          {loading ? (
            <p style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu bếp...</p>
          ) : (
            <KitchenBoard
              items={visibleKitchenItems}
              viewMode={kitchenViewMode}
              kiosk={false}
              now={timeTicker}
              onStatusChange={onStatusChange}
              onCompleteAll={onCompleteAll}
              onPrint={printKitchenTicket}
              onCancelOrder={onCancelOrder}
              thresholds={kdsSettings}
              cookStartMap={cookStartMap}
            />
          )}
        </div>
      )}
    </>
  );
};
