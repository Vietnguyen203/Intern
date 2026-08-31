package com.food.order.ui.kitchen

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.food.order.data.ApiError
import com.food.order.data.KitchenRefreshBus
import com.food.order.data.SessionManager
import com.food.order.data.repository.CatalogRepository
import com.food.order.data.repository.OrderRepository
import com.food.order.data.response.OrderResponse
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * A3 — nâng cấp Bếp (KDS) Mobile lên ngang Web: mirror đúng useKitchen.js + kitchenUtils.js
 * (2 chế độ xem, lọc khu bếp, 3 mức khẩn cấp + đếm ngược, tự động chuyển trạng thái theo ngưỡng,
 * chế độ Kiosk, in phiếu mô phỏng). AndroidViewModel (thay vì ViewModel thường như trước) vì cần
 * Context để đọc CatalogRepository (lấy danh mục món suy ra khu bếp) và SessionManager (đọc/lưu
 * ngưỡng KDS local trên máy).
 */
class KitchenViewModel(app: Application) : AndroidViewModel(app) {

    private val repository = OrderRepository
    private val ctx = app.applicationContext

    // ====== Dữ liệu gốc ======
    private var allItems: List<KitchenItem> = emptyList()

    // foodName -> tên khu bếp (tên danh mục) — ghép theo tên món, giống kitchenItemsWithCategory bên
    // Web vì OrderItemResponse hiện chưa trả categoryId. Load 1 lần, cache lại (catalog ít đổi).
    private var stationMap: Map<String, String> = emptyMap()
    private var stationMapLoaded = false

    // Mốc thời gian ước lượng (phía client) lúc món bắt đầu COOKING — chỉ dùng để tính countdown
    // "tự động Sẵn sàng sau X phút", KHÔNG dùng cho đồng hồ "đã chờ bao lâu" trên vé (đồng hồ đó vẫn
    // tính theo createdAt của đơn) — mirror kdsCookStartRef bên Web.
    private val cookStartMap = HashMap<String, Long>()
    fun getCookStart(itemId: String): Long? = cookStartMap[itemId]

    private val autoTransitionInFlight = HashSet<String>()

    // ====== Flows lộ ra cho UI ======
    private val _groupedByTableFlow = MutableStateFlow<List<KitchenTableGroup>>(emptyList())
    val groupedByTableFlow = _groupedByTableFlow.asStateFlow()

    private val _groupedByStatusFlow = MutableStateFlow<List<KitchenStatusGroup>>(emptyList())
    val groupedByStatusFlow = _groupedByStatusFlow.asStateFlow()

    private val _kitchenItemsFlow = MutableStateFlow<List<KitchenItem>>(emptyList())
    val kitchenItemsFlow = _kitchenItemsFlow.asStateFlow() // toàn bộ item (chưa lọc khu bếp) — dùng để đếm PENDING/COOKING/READY

    private val _categoryOptionsFlow = MutableStateFlow<List<String>>(listOf("ALL"))
    val categoryOptionsFlow = _categoryOptionsFlow.asStateFlow()

    private val _viewModeFlow = MutableStateFlow(KitchenViewMode.TABLE)
    val viewModeFlow = _viewModeFlow.asStateFlow()

    private val _categoryFilterFlow = MutableStateFlow("ALL")
    val categoryFilterFlow = _categoryFilterFlow.asStateFlow()

    private val _kioskModeFlow = MutableStateFlow(false)
    val kioskModeFlow = _kioskModeFlow.asStateFlow()

    private val _kdsSettingsFlow = MutableStateFlow(SessionManager.getKdsSettings(ctx))
    val kdsSettingsFlow = _kdsSettingsFlow.asStateFlow()

    // "Đồng hồ" cưỡng bức re-render các hiển thị phụ thuộc thời gian (thời gian chờ, đếm ngược) —
    // mirror timeTicker bên Web, tick mỗi 15s trong lúc màn Bếp đang mở.
    private val _timeTickerFlow = MutableStateFlow(System.currentTimeMillis())
    val timeTickerFlow = _timeTickerFlow.asStateFlow()

    private val _loadingFlow = MutableStateFlow(false)
    val loadingFlow = _loadingFlow.asStateFlow()

    private val _errorFlow = MutableSharedFlow<String>()
    val errorFlow = _errorFlow.asSharedFlow()

    // Bắn ra khi 1 món tự động chuyển trạng thái (để Fragment Toast + tự in phiếu nếu bật autoPrintOnCooking)
    private val _autoTransitionFlow = MutableSharedFlow<Pair<KitchenItem, String>>()
    val autoTransitionFlow = _autoTransitionFlow.asSharedFlow()

    private var pollingJob: Job? = null
    private var tickerJob: Job? = null
    private var refreshBusJob: Job? = null
    private var lastToken: String = ""

    fun setViewMode(mode: KitchenViewMode) {
        _viewModeFlow.value = mode
    }

    fun setCategoryFilter(cat: String) {
        _categoryFilterFlow.value = cat
        recomputeGroups()
    }

    fun toggleKiosk(enabled: Boolean) {
        _kioskModeFlow.value = enabled
    }

    fun reloadKdsSettings() {
        _kdsSettingsFlow.value = SessionManager.getKdsSettings(ctx)
    }

    // ====== Vòng lặp làm mới: 30s refetch (giống setInterval bên Web) + 15s time-ticker ======
    fun startAutoRefresh(token: String) {
        lastToken = token
        if (pollingJob?.isActive == true) return
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(30000)
                fetchKitchenItems(token, silent = true)
            }
        }
        if (tickerJob?.isActive != true) {
            tickerJob = viewModelScope.launch {
                while (true) {
                    delay(15000)
                    _timeTickerFlow.value = System.currentTimeMillis()
                    checkAutoTransition(token)
                }
            }
        }
        // Refresh sớm khi có FCM push liên quan đơn hàng/thanh toán (xem KitchenRefreshBus +
        // FoodFirebaseMessagingService.onMessageReceived) — bổ sung cho pollingJob 30s ở trên,
        // không thay thế, vì FCM cần Firebase key thật mới hoạt động.
        if (refreshBusJob?.isActive != true) {
            refreshBusJob = viewModelScope.launch {
                KitchenRefreshBus.events.collect {
                    fetchKitchenItems(lastToken, silent = true)
                }
            }
        }
    }

    fun stopAutoRefresh() {
        pollingJob?.cancel(); pollingJob = null
        tickerJob?.cancel(); tickerJob = null
        refreshBusJob?.cancel(); refreshBusJob = null
    }

    fun fetchKitchenItems(token: String, silent: Boolean = false) {
        lastToken = token
        viewModelScope.launch {
            if (!silent) _loadingFlow.value = true
            try {
                if (!stationMapLoaded) loadStationMap(token)

                // Fetch PENDING, CONFIRMED và ORDERING đồng thời. ORDERING = bàn đang ăn, vẫn có
                // thể gọi thêm món — PHẢI lấy luôn, nếu không món gọi thêm ở bàn đang ORDERING vẫn
                // tính tiền bình thường nhưng bếp sẽ không thấy để chế biến (giống Web, xem useKitchen.js).
                val pendingDeferred = async { repository.listOrders(token, "PENDING") }
                val confirmedDeferred = async { repository.listOrders(token, "CONFIRMED") }
                val orderingDeferred = async { repository.listOrders(token, "ORDERING") }

                val pendingRes = pendingDeferred.await()
                val confirmedRes = confirmedDeferred.await()
                val orderingRes = orderingDeferred.await()

                val pendingOrders = if (pendingRes.isSuccess) pendingRes.data ?: emptyList() else emptyList()
                val confirmedOrders = if (confirmedRes.isSuccess) confirmedRes.data ?: emptyList() else emptyList()
                val orderingOrders = if (orderingRes.isSuccess) orderingRes.data ?: emptyList() else emptyList()

                val flat = mutableListOf<KitchenItem>()
                val extractItems = { orders: List<OrderResponse> ->
                    orders.forEach { order ->
                        order.items.forEach { item ->
                            val ks = item.kitchenStatus ?: "PENDING"
                            if (ks == "PENDING" || ks == "COOKING" || ks == "READY") {
                                val foodName = item.foodName ?: "Món không tên"
                                flat.add(
                                    KitchenItem(
                                        orderItemId = item.id.orEmpty(),
                                        foodName = foodName,
                                        quantity = item.quantity ?: 1,
                                        note = item.note,
                                        kitchenStatus = ks,
                                        orderId = order.id.orEmpty(),
                                        tableNumber = if (!order.tableNumber.isNullOrBlank()) {
                                            if (order.tableNumber.contains("Bàn")) order.tableNumber else "Bàn ${order.tableNumber}"
                                        } else {
                                            "Mang đi"
                                        },
                                        createdAt = order.createdAt,
                                        stationName = stationMap[foodName]
                                    )
                                )
                            }
                        }
                    }
                }
                extractItems(pendingOrders)
                extractItems(confirmedOrders)
                extractItems(orderingOrders)

                // Cập nhật cookStartMap: giữ mốc cũ cho món vẫn đang COOKING, dọn món không còn COOKING nữa
                val stillCooking = flat.filter { it.kitchenStatus == "COOKING" }.map { it.orderItemId }.toSet()
                cookStartMap.keys.retainAll(stillCooking)
                stillCooking.forEach { id -> cookStartMap.putIfAbsent(id, System.currentTimeMillis()) }

                allItems = flat
                _kitchenItemsFlow.value = flat
                recomputeGroups()
            } catch (e: Exception) {
                if (!silent) _errorFlow.emit(ApiError.parse(e))
            } finally {
                if (!silent) _loadingFlow.value = false
            }
        }
    }

    private suspend fun loadStationMap(token: String) {
        try {
            val categoriesRes = CatalogRepository.getCategories(ctx, token)
            val itemsRes = CatalogRepository.getMenuItems(ctx, token)
            if (categoriesRes.isSuccess && itemsRes.isSuccess) {
                val catNameById = (categoriesRes.data ?: emptyList()).associate { it.id to it.name }
                val map = HashMap<String, String>()
                (itemsRes.data ?: emptyList()).forEach { mi ->
                    catNameById[mi.categoryId]?.let { catName -> map[mi.foodName] = catName }
                }
                stationMap = map
            }
            stationMapLoaded = true
        } catch (_: Exception) {
            // Không lấy được danh mục (VD: đứt mạng thoáng qua) -> vẫn hiển thị được vé bếp, chỉ thiếu
            // tag khu bếp. Không chặn luồng chính, và KHÔNG đánh dấu đã load để lần refetch sau thử lại.
        }
    }

    /** Gán lại groupedByTable/groupedByStatus + categoryOptions dựa trên allItems + bộ lọc hiện tại. */
    private fun recomputeGroups() {
        val options = mutableListOf("ALL")
        allItems.mapNotNull { it.stationName }.distinct().sorted().let { options.addAll(it) }
        _categoryOptionsFlow.value = options
        if (_categoryFilterFlow.value !in options) _categoryFilterFlow.value = "ALL"

        val filter = _categoryFilterFlow.value
        val visible = if (filter == "ALL") allItems else allItems.filter { it.stationName == filter }

        _groupedByTableFlow.value = visible.groupBy { it.tableNumber }
            .map { (table, items) -> KitchenTableGroup(table, items.sortedBy { parseOrderDateMs(it.createdAt) ?: 0L }) }
            .sortedBy { group -> group.items.minOfOrNull { parseOrderDateMs(it.createdAt) ?: 0L } ?: 0L }

        val statusLabels = listOf("PENDING" to "⏳ Chờ", "COOKING" to "🔥 Đang nấu", "READY" to "✅ Sẵn sàng")
        _groupedByStatusFlow.value = statusLabels.map { (key, label) ->
            KitchenStatusGroup(
                statusKey = key,
                label = label,
                items = visible.filter { it.kitchenStatus == key }.sortedBy { parseOrderDateMs(it.createdAt) ?: 0L }
            )
        }
    }

    fun updateItemStatus(token: String, orderItemId: String, newStatus: String) {
        viewModelScope.launch {
            try {
                val response = repository.updateKitchenItemStatus(token, orderItemId, newStatus)
                if (response.isSuccess) {
                    // Bếp bấm tay chuyển "Đang nấu" cũng là 1 cách món "vào bếp" giống hệt nhánh tự
                    // động theo giờ (autoTransitionFlow ở dưới) — phải tôn trọng cùng cờ
                    // autoPrintOnCooking để hành vi nhất quán ở mọi đường vào COOKING. In trực tiếp ở
                    // đây (không qua autoTransitionFlow) vì flow đó còn gắn với Toast "Tự động..." —
                    // dùng chung sẽ hiện nhầm Toast "tự động" cho 1 thao tác bấm tay.
                    if (newStatus == "COOKING" && _kdsSettingsFlow.value.autoPrintOnCooking) {
                        allItems.find { it.orderItemId == orderItemId }?.let { item ->
                            runCatching { KitchenTicketPrinter.printTicket(ctx, item) }
                        }
                    }
                    fetchKitchenItems(token)
                } else {
                    _errorFlow.emit(response.message ?: "Failed to update status")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            }
        }
    }

    /** Xong tất cả món (PENDING/COOKING) của 1 bàn -> READY 1 lượt — mirror handleCompleteAllItems bên Web. */
    fun completeAllItems(token: String, items: List<KitchenItem>) {
        val targets = items.filter { it.kitchenStatus == "PENDING" || it.kitchenStatus == "COOKING" }
        if (targets.isEmpty()) return
        viewModelScope.launch {
            _loadingFlow.value = true
            try {
                val results = targets.map { item ->
                    async { repository.updateKitchenItemStatus(token, item.orderItemId, "READY") }
                }.map { it.await() }
                val failed = results.count { !it.isSuccess }
                if (failed > 0) {
                    _errorFlow.emit("$failed/${targets.size} món cập nhật thất bại, thử làm mới lại.")
                }
                fetchKitchenItems(token)
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.value = false
            }
        }
    }

    // ====== Tự động chuyển trạng thái theo ngưỡng (nếu bật trong màn Cài đặt KDS) ======
    // Mirror useEffect phụ thuộc timeTicker bên Web: mỗi 15s kiểm tra toàn bộ item, món nào đã chờ
    // đủ lâu thì tự chuyển trạng thái + emit autoTransitionFlow để Fragment Toast/in phiếu.
    private suspend fun checkAutoTransition(token: String) {
        val settings = _kdsSettingsFlow.value
        if (settings.autoStartMinutes <= 0 && settings.autoReadyMinutes <= 0) return
        val now = System.currentTimeMillis()

        for (item in allItems) {
            if (item.orderItemId in autoTransitionInFlight) continue

            if (settings.autoStartMinutes > 0 && item.kitchenStatus == "PENDING") {
                val waitedMs = now - (parseOrderDateMs(item.createdAt) ?: now)
                if (waitedMs >= settings.autoStartMinutes * 60000L) {
                    autoTransitionInFlight.add(item.orderItemId)
                    viewModelScope.launch {
                        try {
                            val res = repository.updateKitchenItemStatus(token, item.orderItemId, "COOKING")
                            if (res.isSuccess) {
                                _autoTransitionFlow.emit(item to "COOKING")
                                fetchKitchenItems(token, silent = true)
                            }
                        } catch (_: Exception) {
                        } finally {
                            autoTransitionInFlight.remove(item.orderItemId)
                        }
                    }
                    continue
                }
            }

            if (settings.autoReadyMinutes > 0 && item.kitchenStatus == "COOKING") {
                val cookStart = cookStartMap[item.orderItemId] ?: (parseOrderDateMs(item.createdAt) ?: now)
                if (now - cookStart >= settings.autoReadyMinutes * 60000L) {
                    autoTransitionInFlight.add(item.orderItemId)
                    viewModelScope.launch {
                        try {
                            val res = repository.updateKitchenItemStatus(token, item.orderItemId, "READY")
                            if (res.isSuccess) {
                                _autoTransitionFlow.emit(item to "READY")
                                fetchKitchenItems(token, silent = true)
                            }
                        } catch (_: Exception) {
                        } finally {
                            autoTransitionInFlight.remove(item.orderItemId)
                        }
                    }
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopAutoRefresh()
    }
}
