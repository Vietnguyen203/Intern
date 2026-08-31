package com.food.order.data.mapper

import com.food.order.data.model.AvailableTableModel
import com.food.order.data.model.ReservationModel
import com.food.order.data.response.AvailableTableResponse
import com.food.order.data.response.ReservationResponse

fun ReservationResponse.toReservationModel(): ReservationModel {
    return ReservationModel(
        id = id.orEmpty(),
        tableLabel = tableNumber?.let { "Bàn $it" } ?: "?",
        customerName = customerName?.takeIf { it.isNotBlank() } ?: "Khách",
        customerPhone = customerPhone.orEmpty(),
        partySize = partySize ?: 0,
        reservedAtDisplay = formatReservedAt(reservedAt),
        status = status ?: "CONFIRMED"
    )
}

fun AvailableTableResponse.toAvailableTableModel(): AvailableTableModel? {
    val safeId = id ?: return null
    return AvailableTableModel(
        id = safeId,
        tableNumber = tableNumber ?: 0,
        capacity = capacity ?: 0
    )
}

// "2026-08-28T19:30:00" -> "19:30 28/08/2026". Không dùng java.time.format vì minSdk của app này
// có thể thấp hơn API 26 (desugaring không chắc đã bật) — parse bằng string đơn giản, đủ dùng vì
// định dạng luôn cố định do chính Android tự sinh ra (xem CreateReservationFragment).
fun formatReservedAt(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val datePart = iso.substringBefore("T")
        val timePart = iso.substringAfter("T").take(5)
        val parts = datePart.split("-")
        if (parts.size != 3) return iso
        "$timePart ${parts[2]}/${parts[1]}/${parts[0]}"
    } catch (e: Exception) {
        iso
    }
}
