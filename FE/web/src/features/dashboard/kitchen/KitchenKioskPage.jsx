import { useState, useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { apiService, WS_BASE_URL } from '../../../services/api';
import { useToast } from '../../../shared/hooks/useToast';
import { ToastContainer } from '../../../shared/components/ToastContainer';
import { useKitchen } from './useKitchen';
import { KitchenBoard } from './KitchenBoard';
import { KDS_SETTINGS_DEFAULT, printKitchenTicket } from './kitchenUtils';

const POLL_MS = 10000; // màn hình này chạy liên tục không ai bấm "Làm mới" -> phải tự làm mới định kỳ

const readKdsSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('kdsSettings') || 'null');
    return saved ? { ...KDS_SETTINGS_DEFAULT, ...saved } : { ...KDS_SETTINGS_DEFAULT };
  } catch { return { ...KDS_SETTINGS_DEFAULT }; }
};

// Token có thể chỉ nằm trong sessionStorage (khi đăng nhập không tick "Ghi nhớ đăng nhập" —
// xem LoginScreen.jsx). Trình duyệt tự sao chép sessionStorage sang tab mới mở qua
// window.open cùng origin (App.jsx không còn dùng noopener/noreferrer nữa, xem comment ở
// đó) nên bình thường không cần làm gì thêm. Vẫn giữ 1 lớp dự phòng ở đây: nếu tab này chưa
// có token nhưng vẫn còn tham chiếu tới tab đã mở ra nó (window.opener, cùng origin), đọc
// nhờ từ đó và lưu lại — phòng trường hợp trình duyệt không tự sao chép (vd: tab được mở lại
// từ lịch sử thay vì bấm nút "Chế độ Kiosk").
const hasToken = () => {
  if (localStorage.getItem('token') || sessionStorage.getItem('token')) return true;
  try {
    if (window.opener && !window.opener.closed) {
      const inherited = window.opener.localStorage.getItem('token') || window.opener.sessionStorage.getItem('token');
      if (inherited) {
        sessionStorage.setItem('token', inherited);
        return true;
      }
    }
  } catch { /* khác origin hoặc opener đã đóng — coi như chưa đăng nhập */ }
  return false;
};

// ============================================================================
// Màn hình Bếp ĐỘC LẬP — mở ở TAB/CỬA SỔ RIÊNG (window.open('/kitchen-kiosk'))
// từ nút "Chế độ Kiosk" trong tab Bếp của trang quản lý chính.
//
// Vì sao tách hẳn ra thành 1 trang riêng thay vì overlay trong cùng tab (cách cũ):
// - Có thể kéo cửa sổ này sang màn hình/TV riêng gắn trong bếp, để chạy liên tục,
//   trong khi tab quản lý chính vẫn dùng bình thường ở máy khác.
// - Không phụ thuộc vào state khổng lồ của App.jsx — tự lấy dữ liệu bàn/thực đơn 1 lần,
//   tự lấy danh sách món cần chế biến và tự làm mới định kỳ (KHÔNG phải dữ liệu giả lập —
//   gọi thẳng cùng API thật mà tab Bếp chính đang dùng).
// ============================================================================
export default function KitchenKioskPage() {
  const { toasts, toast, remove } = useToast();
  const [tables, setTables] = useState([]);
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [kdsSettings, setKdsSettings] = useState(readKdsSettings);
  const [authed, setAuthed] = useState(hasToken());
  const [started, setStarted] = useState(false); // đã bấm gesture vào toàn màn hình chưa
  const [clock, setClock] = useState(new Date());

  const {
    visibleKitchenItems, kitchenCategoryOptions,
    kitchenViewMode, setKitchenViewMode,
    kitchenCategoryFilter, setKitchenCategoryFilter,
    loading, timeTicker, kdsCookStartRef,
    fetchKitchenData, handleUpdateItemStatus, handleCompleteAllItems,
    handleCancelOrderFromKitchen,
  } = useKitchen({ toast, tables, foods, categories, kdsSettings });

  // Nạp danh sách bàn + món/danh mục 1 lần khi mở trang — dùng để hiện tên bàn và nhóm
  // "khu bếp" trên vé, y hệt cách tab Bếp chính đang làm (fetchTablesData/fetchFoodsData).
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const [tablesRes, itemsRes, catsRes] = await Promise.all([
          apiService.dashboard.getTables(),
          apiService.catalog.getItems(true),
          apiService.catalog.getCategories(),
        ]);
        if (tablesRes.data) setTables(tablesRes.data);
        if (itemsRes.data) setFoods(itemsRes.data);
        if (catsRes.data) setCategories(catsRes.data);
      } catch (e) {
        toast.error('Không tải được dữ liệu bàn/thực đơn: ' + e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Tự làm mới món cần chế biến + đọc lại cấu hình KDS (ngưỡng cảnh báo, tự in...) định kỳ.
  // Đây vẫn là lưới an toàn (phòng khi WebSocket bên dưới rớt kết nối) — nguồn làm mới CHÍNH giờ
  // là kênh WebSocket real-time ở effect kế tiếp.
  useEffect(() => {
    if (!authed) return;
    fetchKitchenData();
    const interval = setInterval(() => {
      fetchKitchenData();
      setKdsSettings(readKdsSettings());
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Real-time: nối vào ĐÚNG kênh notification-service mà tab Bếp chính (App.jsx) đang dùng —
  // order-service đã tự bắn thông báo tiêu đề chứa "Đơn hàng"/"Thanh toán" mỗi khi có đơn mới,
  // thêm món, đổi trạng thái món, hay huỷ đơn (xem OrderService.sendNotification), nên chỉ cần
  // lắng nghe đúng kênh này là màn Kiosk thấy món mới NGAY thay vì phải đợi hết POLL_MS.
  useEffect(() => {
    if (!authed) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws-notifications`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000, // Tự động kết nối lại sau 5s nếu bị rớt (mất mạng, backend restart...)
      onConnect: () => {
        stompClient.subscribe('/topic/public', (message) => {
          try {
            const note = JSON.parse(message.body);
            if (note.title?.includes('Đơn hàng') || note.title?.includes('Thanh toán')) {
              fetchKitchenData();
            }
          } catch (e) { /* bỏ qua message không parse được */ }
        });
      },
    });
    stompClient.activate();
    return () => { if (stompClient.active) stompClient.deactivate(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    document.title = '🍳 Bếp — Kiosk';
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Nếu mở trang khi chưa đăng nhập, cho phép thử lại mà không cần tải lại cả trang —
  // ví dụ người dùng đăng nhập ở tab kia xong quay lại tab này.
  useEffect(() => {
    const onFocus = () => setAuthed(hasToken());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Toàn màn hình + giữ màn hình không tắt (Wake Lock) — CẦN 1 cú bấm (gesture) của người
  // dùng để trình duyệt cho phép, nên không thể tự động bật ngay khi trang vừa mở.
  const wakeLockRef = useRef(null);
  const enterFullscreenAndWake = async () => {
    setStarted(true);
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); }
    catch (e) { /* 1 số trình duyệt/thiết bị chặn toàn màn hình — vẫn chạy tiếp dạng cửa sổ thường */ }
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); }
    catch (e) { /* không giữ được màn hình sáng — có thể cần tắt tự khoá màn hình ở Cài đặt máy */ }
  };

  // Wake Lock tự bị trình duyệt nhả khi tab mất focus/khoá màn hình — xin lại khi quay lại.
  useEffect(() => {
    const reacquire = async () => {
      if (started && document.visibilityState === 'visible' && 'wakeLock' in navigator && !wakeLockRef.current) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (e) { /* noop */ }
      }
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => document.removeEventListener('visibilitychange', reacquire);
  }, [started]);

  const counts = (
    <>
      {visibleKitchenItems.filter(i => i.kitchenStatus === 'PENDING').length} chờ &middot;{' '}
      {visibleKitchenItems.filter(i => i.kitchenStatus === 'COOKING').length} đang nấu &middot;{' '}
      {visibleKitchenItems.filter(i => i.kitchenStatus === 'READY').length} sẵn sàng
    </>
  );

  const pageStyle = {
    minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)',
    fontFamily: "'Kanit', system-ui, sans-serif",
  };

  if (!authed) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800 }}>Chưa đăng nhập</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px' }}>
            Mở tab quản lý chính, đăng nhập, rồi bấm lại nút "Chế độ Kiosk" ở tab Bếp.
          </p>
          <button onClick={() => setAuthed(hasToken())} className="btn btn-primary" style={{ padding: '10px 20px' }}>Thử lại</button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '56px', marginBottom: '18px' }}>🍳</div>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 800 }}>Màn hình Bếp</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 24px' }}>
            Bấm để vào chế độ toàn màn hình và giữ màn hình luôn sáng — để trang này chạy
            liên tục trên máy gắn trong bếp.
          </p>
          <button onClick={enterFullscreenAndWake} className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '18px', fontWeight: 800 }}>
            🖥️ Bắt đầu — Toàn màn hình
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <ToastContainer toasts={toasts} onRemove={remove} />
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0 }}>🍳 MÀN HÌNH BẾP</h2>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginTop: '4px' }}>{counts}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace' }}>
              {clock.toLocaleTimeString('vi-VN')}
            </div>
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
            {kitchenCategoryOptions.length > 1 && (
              <select value={kitchenCategoryFilter} onChange={e => setKitchenCategoryFilter(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '15px', fontWeight: 700, borderRadius: '10px', border: '2px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                {kitchenCategoryOptions.map(cat => <option key={cat} value={cat}>{cat === 'ALL' ? 'Tất cả khu' : cat}</option>)}
              </select>
            )}
            <button onClick={fetchKitchenData}
              style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', borderRadius: '10px', border: '2px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
              🔄 Làm mới
            </button>
          </div>
        </div>

        {loading && visibleKitchenItems.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu bếp...</p>
        ) : (
          <KitchenBoard
            items={visibleKitchenItems}
            viewMode={kitchenViewMode}
            kiosk={true}
            now={timeTicker}
            onStatusChange={handleUpdateItemStatus}
            onCompleteAll={handleCompleteAllItems}
            onPrint={printKitchenTicket}
            onCancelOrder={handleCancelOrderFromKitchen}
            thresholds={kdsSettings}
            cookStartMap={kdsCookStartRef.current}
          />
        )}
      </div>
    </div>
  );
}
