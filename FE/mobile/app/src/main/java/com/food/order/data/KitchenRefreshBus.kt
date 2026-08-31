package com.food.order.data

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Cầu nối giữa FoodFirebaseMessagingService (nhận FCM push khi app foreground) và
 * KitchenViewModel — mirror đúng cách Web lọc tiêu đề notification trên kênh WebSocket
 * /ws-notifications (App.jsx: note.title?.includes('Đơn hàng') || includes('Thanh toán')) để
 * quyết định có refresh màn Bếp hay không.
 *
 * FCM chỉ là 1 tín hiệu "có gì đó mới, refetch cho chắc" — KHÔNG mang dữ liệu đơn hàng thật, nên
 * bus chỉ phát Unit (replay = 0, buffer = 1 để không rớt tín hiệu nếu ViewModel đang bận 1 nhịp).
 * KitchenViewModel.startAutoRefresh vẫn giữ pollingJob 30s làm lưới an toàn — bus này chỉ giúp
 * refresh sớm hơn khi có push, không thay thế polling.
 */
object KitchenRefreshBus {
    private val _events = MutableSharedFlow<Unit>(replay = 0, extraBufferCapacity = 1)
    val events: SharedFlow<Unit> = _events.asSharedFlow()

    fun notifyOrderChanged() {
        _events.tryEmit(Unit)
    }
}
