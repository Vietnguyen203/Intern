import { Users, CheckCircle } from 'lucide-react';
import { KDS_SETTINGS_DEFAULT, getKitchenUrgency, getKitchenWaitMinutes, formatCountdown } from './kitchenUtils';
import { useAutoCountdown } from './useAutoCountdown';

export const KitchenTicket = ({ item, now, kiosk, onStatusChange, onPrint, onCancelOrder, thresholds = KDS_SETTINGS_DEFAULT, cookStartMap }) => {
  const ks = item.kitchenStatus;
  const chipBg = ks === 'PENDING' ? 'var(--chip-pending-bg)' : ks === 'COOKING' ? 'var(--chip-cooking-bg)' : ks === 'READY' ? 'var(--chip-ready-bg)' : 'var(--bg-app)';
  const chipText = ks === 'PENDING' ? 'var(--chip-pending-text)' : ks === 'COOKING' ? 'var(--chip-cooking-text)' : ks === 'READY' ? 'var(--chip-ready-text)' : 'var(--text-secondary)';
  const urgency = getKitchenUrgency(item, now, thresholds);
  const waited = getKitchenWaitMinutes(item, now);
  const isUrgent = urgency === 'critical';
  const isWarning = urgency === 'warning';
  const borderColor = isUrgent ? 'var(--chip-urgent-border)' : isWarning ? 'var(--accent-pending)' : 'var(--border-color)';

  // Mốc thời gian sẽ tự động chuyển trạng thái, nếu setting tương ứng > 0
  let autoTargetTime = null;
  if (ks === 'PENDING' && thresholds.autoStartMinutes > 0 && item.createdAt) {
    autoTargetTime = new Date(item.createdAt).getTime() + thresholds.autoStartMinutes * 60000;
  } else if (ks === 'COOKING' && thresholds.autoReadyMinutes > 0) {
    const cookStart = (cookStartMap && cookStartMap.get(item.id)) || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now());
    autoTargetTime = cookStart + thresholds.autoReadyMinutes * 60000;
  }
  const countdownSeconds = useAutoCountdown(autoTargetTime);
  const btnStyle = (color) => ({
    flex: 1,
    padding: kiosk ? '18px' : '8px',
    fontSize: kiosk ? '18px' : '12px',
    minHeight: kiosk ? '56px' : 'auto',
    fontWeight: '700',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: color,
    color: 'white',
  });
  const Dot = () => <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />;

  return (
    <div style={{
      padding: kiosk ? '20px' : '12px',
      borderRadius: '12px',
      backgroundColor: isUrgent ? 'var(--chip-urgent-bg)' : 'var(--bg-surface)',
      border: `${urgency === 'normal' ? 1 : 2}px solid ${borderColor}`,
      animation: isUrgent ? 'kdsPulse 1.2s ease-in-out infinite' : 'none',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: kiosk ? '14px' : '8px' }}>
        <div style={{ flex: 1 }}>
          <h5 style={{ fontSize: kiosk ? '24px' : '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{item.foodName}</h5>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: kiosk ? '20px' : '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>x{item.quantity}</span>
            <Dot />
            <span style={{
              fontSize: kiosk ? '15px' : '11px', fontWeight: '700', textTransform: 'uppercase',
              padding: '2px 9px', borderRadius: '20px', backgroundColor: chipBg, color: chipText,
            }}>
              {ks === 'PENDING' ? '⏳ Chờ' : ks === 'COOKING' ? '🔥 Nấu' : ks === 'READY' ? '✅ Sẵn sàng' : ks}
            </span>
            {item.createdAt && (
              <>
                <Dot />
                <span style={{ fontSize: kiosk ? '16px' : '11px', fontWeight: urgency !== 'normal' ? '800' : '600', color: isUrgent ? 'var(--chip-urgent-border)' : isWarning ? 'var(--accent-pending)' : 'var(--text-secondary)' }}>
                  ⏱️ {waited > 0 ? `${waited} phút` : 'Vừa xong'}{isUrgent ? ' — QUÁ LÂU!' : ''}
                </span>
              </>
            )}
            {item.stationName && (
              <>
                <Dot />
                <span style={{ fontSize: kiosk ? '15px' : '11px', fontWeight: '600', color: '#6366F1' }}>{item.stationName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {item.note && (
        <div style={{ fontSize: kiosk ? '15px' : '12px', fontStyle: 'italic', color: 'var(--chip-pending-text)', backgroundColor: 'var(--chip-pending-bg)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid var(--accent-pending)' }}>
          📝 {item.note}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {ks === 'PENDING' && (
          <button onClick={() => onStatusChange(item.id, 'COOKING')} style={btnStyle('var(--btn-cook)')}>
            {countdownSeconds !== null
              ? (countdownSeconds > 0 ? `🔥 Tự nấu sau ${formatCountdown(countdownSeconds)}` : '🔥 Nấu ngay')
              : '🔥 Nấu'}
          </button>
        )}
        {ks === 'COOKING' && (
          <button onClick={() => onStatusChange(item.id, 'READY')} style={btnStyle('var(--btn-ready)')}>
            {countdownSeconds !== null
              ? (countdownSeconds > 0 ? `✅ Tự xong sau ${formatCountdown(countdownSeconds)}` : '✅ Xong ngay')
              : '✅ Xong'}
          </button>
        )}
        {ks === 'READY' && (
          // Bình thường waiter xác nhận trả món ở tab Orders (theo bàn) — nhưng đơn không gắn với
          // bàn thật nào (VD đơn cũ lỡ tạo "Mang đi" trước khi có chặn ở CustomerOrderApp.jsx) sẽ
          // KHÔNG BAO GIỜ hiện ở panel theo bàn đó, nên phải có đường thoát ngay tại đây — bấm được
          // luôn thay vì chỉ là dòng chữ tĩnh, để không có đơn nào bị kẹt vĩnh viễn.
          <button onClick={() => onStatusChange(item.id, 'SERVED')}
            style={{ ...btnStyle('var(--btn-wait-bg)'), color: 'var(--btn-wait-text)' }}>
            🛎️ Đã trả món
          </button>
        )}
        {onPrint && (
          <button onClick={() => onPrint(item)} title="In phiếu (mô phỏng — tải ảnh)"
            style={{ padding: kiosk ? '18px' : '8px', minWidth: kiosk ? '56px' : '36px', minHeight: kiosk ? '56px' : 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: kiosk ? '18px' : '14px' }}>
            🖨️
          </button>
        )}
        {onCancelOrder && (
          // Nút phụ, luôn có mặt bất kể trạng thái món — lối thoát chung cho MỌI đơn tab Bếp thấy,
          // kể cả đơn "mồ côi" không thuộc bàn nào (xem comment ở nút "Đã trả món" phía trên).
          // window.confirm thay vì dùng chung ConfirmDialog của App.jsx vì cụm Kitchen* cố tình
          // được tách rời, dùng lại y hệt ở cả tab Bếp thường lẫn màn Kiosk độc lập.
          <button
            onClick={() => {
              if (window.confirm(`Huỷ đơn hàng chứa "${item.foodName}"? Nguyên liệu đã trừ sẽ được hoàn lại kho.`)) {
                onCancelOrder(item.orderId);
              }
            }}
            title="Huỷ đơn hàng"
            style={{ padding: kiosk ? '18px' : '8px', minWidth: kiosk ? '56px' : '36px', minHeight: kiosk ? '56px' : 'auto', borderRadius: '8px', border: '1px solid var(--chip-urgent-border)', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', color: 'var(--chip-urgent-border)', fontSize: kiosk ? '18px' : '14px' }}>
            ❌
          </button>
        )}
      </div>
    </div>
  );
};
