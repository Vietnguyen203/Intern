// ---------------------------------------------------------
// Kitchen Display System (KDS) — hàm thuần, không phụ thuộc React.
// ---------------------------------------------------------
// Giá trị mặc định — có thể chỉnh trong tab Settings (xem kdsSettings/KDS_SETTINGS_DEFAULT trong DashboardScreen).
// autoPrintOnCooking mặc định BẬT — in phiếu là việc bếp cần thấy ngay khi món "vào bếp"
// (COOKING), qua bất kỳ đường nào: xác nhận đặt món, bếp bấm tay, hay tự động theo giờ.
// Người dùng vẫn tắt được trong Settings nếu không muốn tự tải ảnh phiếu mô phỏng.
export const KDS_SETTINGS_DEFAULT = { warningMinutes: 10, criticalMinutes: 15, autoStartMinutes: 0, autoReadyMinutes: 0, autoPrintOnCooking: true };

const wrapCanvasTextLines = (ctx, text, maxWidth) => {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  return lines;
};

// --- "Máy in bếp" mô phỏng: chưa có máy in nhiệt thật để test, nên thay vì gọi lệnh in,
// mình vẽ phiếu ra <canvas> rồi tải về dưới dạng ảnh PNG — coi như "tờ giấy" máy in nhả ra.
// Khi nào có máy in ESC/POS thật, chỉ cần thay hàm này bằng lệnh gửi lệnh in tương ứng.
export const printKitchenTicket = (item) => {
  const width = 420; // mô phỏng khổ giấy in nhiệt ~80mm
  const padding = 20;
  const contentWidth = width - padding * 2;

  // Canvas tạm chỉ để đo chữ (biết trước cần bao nhiêu dòng) trước khi dựng canvas thật với đúng chiều cao.
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');

  mctx.font = 'bold 20px monospace';
  const nameLines = wrapCanvasTextLines(mctx, `${item.quantity || 1}x ${item.foodName || 'Món'}`, contentWidth);

  let noteLines = [];
  if (item.note) {
    mctx.font = 'italic 14px monospace';
    noteLines = wrapCanvasTextLines(mctx, `Ghi chú: ${item.note}`, contentWidth);
  }

  const timeStr = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

  let height = padding + 32 + 26 + 16; // tiêu đề + dòng phụ đề + gạch ngang
  height += 26; // dòng tên bàn
  height += nameLines.length * 26 + 6;
  if (noteLines.length) height += noteLines.length * 20 + 6;
  height += 20; // "Vào bếp: ..."
  if (item.orderId) height += 20; // "Mã đơn: ..."
  height += 16 + padding; // gạch ngang cuối + padding dưới

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 220);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000'; ctx.textBaseline = 'top';

  let y = padding;
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('PHIẾU BẾP', width / 2, y); y += 32;
  ctx.font = '12px monospace';
  ctx.fillText('— mô phỏng máy in, chưa nối máy in thật —', width / 2, y); y += 26;
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#000';
  ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke(); y += 16;

  ctx.font = 'bold 17px monospace';
  ctx.fillText(item.tableNumber || 'Mang về', padding, y); y += 26;

  ctx.font = 'bold 20px monospace';
  nameLines.forEach(l => { ctx.fillText(l, padding, y); y += 26; });
  y += 6;

  if (noteLines.length) {
    ctx.font = 'italic 14px monospace';
    noteLines.forEach(l => { ctx.fillText(l, padding, y); y += 20; });
    y += 6;
  }

  ctx.font = '13px monospace';
  ctx.fillText(`Vào bếp: ${timeStr}`, padding, y); y += 20;
  if (item.orderId) { ctx.fillText(`Mã đơn: #${item.orderId}`, padding, y); y += 20; }

  y += 6;
  ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  const safeTable = String(item.tableNumber || 'mang-ve').replace(/\s+/g, '-');
  const safeFood = String(item.foodName || 'mon').replace(/\s+/g, '-');
  link.download = `phieu-bep_${safeTable}_${safeFood}_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getKitchenWaitMinutes = (item, now) => {
  if (!item.createdAt) return 0;
  return Math.floor((now - new Date(item.createdAt).getTime()) / 60000);
};

// Urgency chỉ tính cho món còn đang chờ/đang nấu — món đã READY không cần "giục" bếp nữa.
export const getKitchenUrgency = (item, now, thresholds = KDS_SETTINGS_DEFAULT) => {
  const isActive = item.kitchenStatus === 'PENDING' || item.kitchenStatus === 'COOKING';
  if (!isActive) return 'normal';
  const waited = getKitchenWaitMinutes(item, now);
  if (waited >= thresholds.criticalMinutes) return 'critical';
  if (waited >= thresholds.warningMinutes) return 'warning';
  return 'normal';
};

export const formatCountdown = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
