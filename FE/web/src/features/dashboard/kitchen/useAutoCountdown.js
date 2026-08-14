import { useState, useEffect } from 'react';

// Đếm ngược tới mốc tự động chuyển trạng thái (nếu bếp có bật setting autoStartMinutes / autoReadyMinutes).
// Chạy tick riêng 1 giây/lần CHỈ khi có đếm ngược cần hiển thị, để không kéo cả DashboardScreen re-render mỗi giây.
export const useAutoCountdown = (targetTime) => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!targetTime) return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  if (!targetTime) return null;
  return Math.max(0, Math.round((targetTime - Date.now()) / 1000));
};
