import { KitchenBoard } from './KitchenBoard';
import { printKitchenTicket } from './kitchenUtils';

// Component UI của tab Bếp — nhận toàn bộ state/handler từ hook useKitchen qua props,
// tự nó không gọi API, không giữ state (ngoại trừ style/JSX thuần).
// Gồm 2 phần độc lập, y hệt cấu trúc cũ trong DashboardScreen:
// - `active`: nội dung tab Bếp bình thường (chỉ hiện khi đang đứng ở tab này)
// - `kioskMode`: overlay toàn màn hình cho tablet/màn hình gắn trong bếp (hiện độc lập với tab đang chọn)
export const KitchenTab = ({
  active, kioskMode,
  kitchenItems, visibleKitchenItems, kitchenCategoryOptions,
  kitchenViewMode, setKitchenViewMode,
  kitchenCategoryFilter, setKitchenCategoryFilter,
  loading, timeTicker, kdsSettings, cookStartMap,
  onStatusChange, onCompleteAll,
  onRefresh, onEnterKiosk, onExitKiosk,
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
              <button onClick={onEnterKiosk} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>🖥️ Chế độ Kiosk</button>
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
              thresholds={kdsSettings}
              cookStartMap={cookStartMap}
            />
          )}
        </div>
      )}

      {/* KDS KIOSK — màn hình toàn màn hình dành cho tablet/màn hình gắn trong bếp */}
      {kioskMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'var(--bg-app)', overflowY: 'auto', padding: '28px' }}>
          <style>{`
            @keyframes kdsPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35); }
              50% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>🍳 MÀN HÌNH BẾP</h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginTop: '4px' }}>{counts}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                <button onClick={() => setKitchenViewMode('table')}
                  style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'table' ? 'var(--primary)' : 'var(--bg-surface)', color: kitchenViewMode === 'table' ? '#FFF' : 'var(--text-primary)' }}>
                  🗂️ Theo bàn
                </button>
                <button onClick={() => setKitchenViewMode('status')}
                  style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'status' ? 'var(--primary)' : 'var(--bg-surface)', color: kitchenViewMode === 'status' ? '#FFF' : 'var(--text-primary)' }}>
                  📊 Theo trạng thái
                </button>
              </div>
              <button onClick={onRefresh} style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', borderRadius: '10px', border: '2px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                🔄 Làm mới
              </button>
              <button onClick={onExitKiosk} style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--chip-urgent-border)', color: '#FFF' }}>
                ✕ Thoát Kiosk
              </button>
            </div>
          </div>

          {categoryFilterBar(true)}

          <KitchenBoard
            items={visibleKitchenItems}
            viewMode={kitchenViewMode}
            kiosk={true}
            now={timeTicker}
            onStatusChange={onStatusChange}
            onCompleteAll={onCompleteAll}
            onPrint={printKitchenTicket}
            thresholds={kdsSettings}
            cookStartMap={cookStartMap}
          />
        </div>
      )}
    </>
  );
};
