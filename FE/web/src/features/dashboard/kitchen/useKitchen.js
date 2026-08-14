import { useState, useRef, useEffect, useMemo } from 'react';
import { apiService } from '../../../services/api';
import { printKitchenTicket } from './kitchenUtils';

// Hook giữ toàn bộ state + logic nghiệp vụ của tab Bếp (KDS): danh sách món cần chế biến,
// chế độ xem, lọc theo khu bếp, chế độ Kiosk toàn màn hình, tự động chuyển trạng thái theo thời gian.
//
// Nhận từ bên ngoài (do các tab khác sở hữu, không thuộc domain Bếp):
// - toast: hệ thống thông báo dùng chung toàn app
// - tables: danh sách bàn (tab Tables) — dùng để hiển thị tên bàn trên vé bếp
// - foods, categories: danh sách món & danh mục (tab Menu & Food) — dùng để suy ra "khu bếp" (stationName)
// - kdsSettings: ngưỡng cảnh báo/tự động chuyển trạng thái (chỉnh trong tab Settings)
export const useKitchen = ({ toast, tables, foods, categories, kdsSettings }) => {
  const [kitchenItems, setKitchenItems] = useState([]);

  // --- KDS: chế độ xem, lọc theo khu bếp, chế độ Kiosk toàn màn hình ---
  const [kitchenViewMode, setKitchenViewMode] = useState('table'); // 'table' | 'status'
  const [kitchenCategoryFilter, setKitchenCategoryFilter] = useState('ALL');
  const [kdsKioskMode, setKdsKioskMode] = useState(false);
  const kdsWakeLockRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // State để cưỡng bức re-render các hiển thị phụ thuộc thời gian (thời gian chờ trên vé bếp).
  // Chỉ tab Bếp dùng biến này — không có tab nào khác phụ thuộc, nên đưa hẳn vào đây thay vì để ở DashboardScreen.
  const [timeTicker, setTimeTicker] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTimeTicker(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Ghép món trong bếp với danh mục món ăn (khu bếp) dựa trên tên món.
  // Ghi chú: OrderItemResponse hiện chỉ trả về foodName, chưa có categoryId/menuItemId,
  // nên đây là cách ghép tạm qua tên món. Nếu backend bổ sung categoryId vào OrderItemResponse
  // thì nên ghép trực tiếp bằng id để chính xác tuyệt đối (tránh trùng tên món ở danh mục khác).
  const kitchenItemsWithCategory = useMemo(() => {
    const foodCategoryMap = new Map();
    (foods || []).forEach(f => {
      const catName = (categories || []).find(c => c.id === f.categoryId)?.name;
      if (catName) foodCategoryMap.set(f.foodName, catName);
    });
    return kitchenItems.map(item => ({ ...item, stationName: foodCategoryMap.get(item.foodName) || null }));
  }, [kitchenItems, foods, categories]);

  const kitchenCategoryOptions = useMemo(() => {
    const set = new Set();
    kitchenItemsWithCategory.forEach(i => { if (i.stationName) set.add(i.stationName); });
    return ['ALL', ...Array.from(set).sort()];
  }, [kitchenItemsWithCategory]);

  useEffect(() => {
    if (!kitchenCategoryOptions.includes(kitchenCategoryFilter)) setKitchenCategoryFilter('ALL');
  }, [kitchenCategoryOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleKitchenItems = useMemo(() => {
    if (kitchenCategoryFilter === 'ALL') return kitchenItemsWithCategory;
    return kitchenItemsWithCategory.filter(i => i.stationName === kitchenCategoryFilter);
  }, [kitchenItemsWithCategory, kitchenCategoryFilter]);

  // Bật/tắt chế độ Kiosk: toàn màn hình + giữ màn hình tablet không tắt (Wake Lock).
  const enterKitchenKiosk = async () => {
    setKdsKioskMode(true);
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (e) { console.warn('Không thể bật toàn màn hình:', e); }
    try {
      if ('wakeLock' in navigator) kdsWakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (e) { console.warn('Không thể giữ màn hình sáng (Wake Lock):', e); }
  };
  const exitKitchenKiosk = () => {
    setKdsKioskMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (kdsWakeLockRef.current) { kdsWakeLockRef.current.release().catch(() => {}); kdsWakeLockRef.current = null; }
  };
  useEffect(() => {
    const handleFsChange = () => { if (!document.fullscreenElement) setKdsKioskMode(false); };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const fetchKitchenData = async () => {
    setLoading(true);
    try {
      // Lấy đơn PENDING, CONFIRMED và ORDERING, flatten items để bếp thấy từng món.
      // ORDERING = bàn đang ăn, vẫn có thể gọi thêm món — PHẢI lấy luôn, nếu không món gọi thêm
      // ở bàn đang ORDERING vẫn tính tiền bình thường nhưng bếp sẽ không thấy để chế biến.
      const [pendingRes, confirmedRes, orderingRes] = await Promise.allSettled([
        apiService.kitchen.getPendingOrders(),
        apiService.kitchen.getConfirmedOrders(),
        apiService.kitchen.getOrderingOrders(),
      ]);

      const orders = [
        ...(pendingRes.status === 'fulfilled' ? (pendingRes.value.data || []) : []),
        ...(confirmedRes.status === 'fulfilled' ? (confirmedRes.value.data || []) : []),
        ...(orderingRes.status === 'fulfilled' ? (orderingRes.value.data || []) : []),
      ];

      // Flatten: mỗi item giữ thông tin đơn (bàn, orderId, orderStatus)
      const flatItems = orders.flatMap(order => {
        const table = tables.find(t => String(t.id) === String(order.tableId));
        const tableName = table ? `Bàn ${table.tableNumber}` : (order.tableNumber || order.tableId || '—');

        return (order.items || []).map(item => ({
          ...item,
          tableNumber: tableName,
          orderId: order.id,
          orderStatus: order.status,
          createdAt: order.createdAt,
        }));
      }).filter(item => item.kitchenStatus !== 'SERVED');

      setKitchenItems(flatItems);
    } catch (error) { console.error('Error fetching kitchen data:', error); }
    finally { setLoading(false); }
  };

  const handleUpdateItemStatus = async (itemId, newStatus) => {
    try {
      await apiService.kitchen.updateItemStatus(itemId, newStatus);
      const labels = { COOKING: 'đang nấu', READY: 'sẵn sàng', SERVED: 'đã phục vụ' };
      toast.success(`Cập nhật món → ${labels[newStatus] || newStatus}`);
      fetchKitchenData();
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  const handleCompleteAllItems = async (items) => {
    try {
      const pendingAndCooking = items.filter(i => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'COOKING');
      if (pendingAndCooking.length === 0) return;
      await Promise.all(pendingAndCooking.map(item =>
        apiService.kitchen.updateItemStatus(item.id, 'READY')
      ));
      toast.success(`Đã hoàn thành ${pendingAndCooking.length} món`);
      fetchKitchenData();
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  // --- KDS: tự động chuyển trạng thái món theo thời gian (nếu bật trong Settings) ---
  // Mục tiêu: giảm số lần bếp phải chạm màn hình liên tục trong lúc tay đang bận nấu.
  const kdsCookStartRef = useRef(new Map()); // itemId -> mốc thời gian (ước lượng phía client) khi món bắt đầu COOKING
  const kdsAutoTransitionInFlightRef = useRef(new Set());

  useEffect(() => {
    // Chỉ dùng để ước lượng thời điểm bắt đầu nấu cho logic tự-động-Sẵn-sàng bên dưới —
    // KHÔNG dùng cho đồng hồ hiển thị trên vé (đồng hồ hiển thị vẫn tính theo giờ tạo đơn, đúng nghĩa "khách đã chờ bao lâu").
    const next = new Map();
    kitchenItems.forEach(item => {
      if (item.kitchenStatus === 'COOKING') {
        next.set(item.id, kdsCookStartRef.current.get(item.id) || Date.now());
      }
    });
    kdsCookStartRef.current = next;
  }, [kitchenItems]);

  useEffect(() => {
    if (kdsSettings.autoStartMinutes <= 0 && kdsSettings.autoReadyMinutes <= 0) return;
    kitchenItems.forEach(item => {
      if (kdsAutoTransitionInFlightRef.current.has(item.id)) return;

      if (kdsSettings.autoStartMinutes > 0 && item.kitchenStatus === 'PENDING' && item.createdAt) {
        const waitedMs = timeTicker - new Date(item.createdAt).getTime();
        if (waitedMs >= kdsSettings.autoStartMinutes * 60000) {
          kdsAutoTransitionInFlightRef.current.add(item.id);
          apiService.kitchen.updateItemStatus(item.id, 'COOKING')
            .then(() => {
              toast.info(`⏱️ Tự động bắt đầu nấu: ${item.foodName}`);
              // In phiếu ngay lúc này để bếp không bị "quên" món tự động chuyển mà không ai bấm tay.
              if (kdsSettings.autoPrintOnCooking) printKitchenTicket(item);
              fetchKitchenData();
            })
            .catch(() => {})
            .finally(() => kdsAutoTransitionInFlightRef.current.delete(item.id));
          return;
        }
      }

      if (kdsSettings.autoReadyMinutes > 0 && item.kitchenStatus === 'COOKING') {
        const cookStart = kdsCookStartRef.current.get(item.id) || (item.createdAt ? new Date(item.createdAt).getTime() : timeTicker);
        if (timeTicker - cookStart >= kdsSettings.autoReadyMinutes * 60000) {
          kdsAutoTransitionInFlightRef.current.add(item.id);
          apiService.kitchen.updateItemStatus(item.id, 'READY')
            .then(() => { toast.info(`✅ Tự động chuyển Sẵn sàng: ${item.foodName}`); fetchKitchenData(); })
            .catch(() => {})
            .finally(() => kdsAutoTransitionInFlightRef.current.delete(item.id));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTicker, kdsSettings.autoStartMinutes, kdsSettings.autoReadyMinutes]);

  return {
    kitchenItems,
    visibleKitchenItems,
    kitchenCategoryOptions,
    kitchenViewMode, setKitchenViewMode,
    kitchenCategoryFilter, setKitchenCategoryFilter,
    kdsKioskMode, enterKitchenKiosk, exitKitchenKiosk,
    loading, timeTicker, kdsCookStartRef,
    fetchKitchenData, handleUpdateItemStatus, handleCompleteAllItems,
  };
};
