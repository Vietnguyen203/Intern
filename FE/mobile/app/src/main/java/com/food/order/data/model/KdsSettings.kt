package com.food.order.data.model

/**
 * Ngưỡng cảnh báo & tự động chuyển trạng thái của KDS (Kitchen Display System) — mirror
 * KDS_SETTINGS_DEFAULT bên Web (kitchenUtils.js). Lưu local trên máy (SharedPreferences qua
 * SessionManager), KHÔNG đồng bộ server — Web cũng đang lưu ở localStorage, mỗi thiết bị/tablet
 * bếp tự chỉnh ngưỡng riêng.
 */
data class KdsSettings(
    val warningMinutes: Int = 10,
    val criticalMinutes: Int = 15,
    val autoStartMinutes: Int = 0,
    val autoReadyMinutes: Int = 0,
    // Mặc định BẬT — in phiếu là việc bếp cần thấy ngay khi món "vào bếp" (COOKING), qua bất kỳ
    // đường nào: xác nhận đặt món, bếp bấm tay, hay tự động theo giờ. Vẫn tắt được trong màn
    // Cài đặt KDS nếu không muốn tự mở màn hình Chia sẻ ảnh phiếu mô phỏng mỗi lần.
    val autoPrintOnCooking: Boolean = true
) {
    companion object {
        val DEFAULT = KdsSettings()
    }
}
