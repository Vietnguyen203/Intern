package com.food.order.ui.kitchen

import com.food.order.data.model.KdsSettings
import java.text.SimpleDateFormat
import java.util.Locale

data class KitchenItem(
    val orderItemId: String,
    val foodName: String,
    val quantity: Int,
    val note: String?,
    val kitchenStatus: String,
    val orderId: String,
    val tableNumber: String,
    // NEW (A3 — nâng cấp KDS): giờ tạo ĐƠN (không phải giờ tạo item, BE chưa có) — dùng để tính thời
    // gian chờ, y hệt cách Web dùng order.createdAt cho mọi item của đơn đó (xem useKitchen.js).
    val createdAt: String? = null,
    // NEW: khu bếp (tên danh mục món) — ghép theo TÊN món với danh sách catalog, giống
    // kitchenItemsWithCategory bên Web vì OrderItemResponse hiện chưa trả categoryId.
    val stationName: String? = null
)

data class KitchenTableGroup(
    val tableNumber: String,
    val items: List<KitchenItem>
)

// NEW: nhóm theo trạng thái — dùng khi kitchenViewMode = STATUS (mirror cột PENDING/COOKING/READY bên Web)
data class KitchenStatusGroup(
    val statusKey: String,
    val label: String,
    val items: List<KitchenItem>
)

enum class KitchenViewMode { TABLE, STATUS }

// Dòng nhóm hợp nhất để KitchenAdapter render được cả 2 chế độ xem (theo bàn / theo trạng thái)
// bằng CÙNG 1 kiểu thẻ (card header + danh sách vé) — trên điện thoại không đủ chỗ để làm lưới 3
// cột như bản Web (KitchenBoard viewMode='status'), nên "theo trạng thái" ở Mobile hiển thị thành
// các nhóm PENDING/COOKING/READY xếp dọc thay vì cạnh nhau; nội dung/hành vi vẫn đầy đủ như Web.
data class KitchenGroupRow(
    val headerTitle: String,
    val itemCountLabel: String,
    val showCompleteAll: Boolean,
    val completeAllTargets: List<KitchenItem>,
    val items: List<KitchenItem>
)

enum class KitchenUrgency { NORMAL, WARNING, CRITICAL }

// BE trả createdAt dạng "yyyy-MM-dd'T'HH:mm:ss" (xem OrderHistoryAdapter.kt dùng cùng định dạng).
private val ORDER_DATE_FORMAT = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)

fun parseOrderDateMs(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return runCatching { ORDER_DATE_FORMAT.parse(iso)?.time }.getOrNull()
}

/** Số phút đã chờ kể từ lúc tạo đơn — 0 nếu không rõ giờ tạo (giống getKitchenWaitMinutes bên Web). */
fun getKitchenWaitMinutes(item: KitchenItem, nowMs: Long): Int {
    val createdMs = parseOrderDateMs(item.createdAt) ?: return 0
    return ((nowMs - createdMs) / 60000L).toInt().coerceAtLeast(0)
}

/** Mức khẩn cấp — chỉ tính cho món còn PENDING/COOKING, món đã READY không cần "giục" bếp nữa. */
fun getKitchenUrgency(item: KitchenItem, nowMs: Long, thresholds: KdsSettings): KitchenUrgency {
    val isActive = item.kitchenStatus == "PENDING" || item.kitchenStatus == "COOKING"
    if (!isActive) return KitchenUrgency.NORMAL
    val waited = getKitchenWaitMinutes(item, nowMs)
    return when {
        waited >= thresholds.criticalMinutes -> KitchenUrgency.CRITICAL
        waited >= thresholds.warningMinutes -> KitchenUrgency.WARNING
        else -> KitchenUrgency.NORMAL
    }
}

fun formatCountdown(totalSeconds: Long): String {
    val s = totalSeconds.coerceAtLeast(0)
    val m = s / 60
    val sec = s % 60
    return "%02d:%02d".format(m, sec)
}
