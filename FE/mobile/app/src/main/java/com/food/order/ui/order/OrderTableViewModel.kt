package com.food.order.ui.order

import android.content.Context
import android.os.Bundle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.food.order.data.ApiError
import com.food.order.data.SessionManager
import com.food.order.data.mapper.toTableModel
import com.food.order.data.model.ApiResponse
import com.food.order.data.model.PageMeta
import com.food.order.data.model.Order
import com.food.order.data.model.OrderItem
import com.food.order.data.model.Receipt
import com.food.order.data.model.TableModel
import com.food.order.data.repository.CatalogRepository
import com.food.order.data.repository.OrderRepository
import com.food.order.data.repository.TableRepository
import com.food.order.data.request.CheckoutRequest
import com.food.order.data.request.CopyItemsRequest
import com.food.order.data.request.DeductStockItem
import com.food.order.data.request.DeductStockRequest
import com.food.order.data.response.*
import com.food.order.ui.kitchen.KitchenItem
import com.food.order.ui.kitchen.KitchenTicketPrinter
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OrderTableViewModel : ViewModel() {

    private val tableRepository = TableRepository
    private val orderRepository = OrderRepository
    private val catalogRepository = CatalogRepository

    // Cache đơn hiện tại (từ getOrderInfo) để cancelOrder() biết cần hoàn kho những món nào
    private var currentOrder: OrderResponse? = null

    private val _loadingFlow = MutableSharedFlow<Boolean>(replay = 0)
    val loadingFlow = _loadingFlow.asSharedFlow()

    private val _errorFlow = MutableSharedFlow<String>(replay = 0)
    val errorFlow = _errorFlow.asSharedFlow()

    private val _tableFlow = MutableSharedFlow<TableModel?>()
    val tableFlow = _tableFlow.asSharedFlow()

    private val _employeeOrderFlow = MutableSharedFlow<EmployeeOrderResponse?>()
    val employeeOrderFlow = _employeeOrderFlow.asSharedFlow()

    private val _copyOrderFlow = MutableSharedFlow<Boolean?>()
    val copyOrderFlow = _copyOrderFlow.asSharedFlow()

    private val _orderFlow = MutableSharedFlow<OrderResponse>()
    val orderFlow = _orderFlow.asSharedFlow()

    private val _cancelOrderFlow = MutableSharedFlow<Boolean>()
    val cancelOrderFlow = _cancelOrderFlow.asSharedFlow()

    private val _confirmOrderFlow = MutableSharedFlow<Boolean>()
    val confirmOrderFlow = _confirmOrderFlow.asSharedFlow()

    private val _completedOrderFlow = MutableSharedFlow<String>()
    val completedOrderFlow = _completedOrderFlow.asSharedFlow()

    private val _listOrderFlow = MutableStateFlow<List<Order>>(emptyList())
    val listOrderFlow: MutableStateFlow<List<Order>> = _listOrderFlow

    private val _removeItemFromOrderFlow = MutableSharedFlow<Boolean>()
    val removeItemFromOrderFlow = _removeItemFromOrderFlow.asSharedFlow()

    private val _tablesFreeFlow = MutableSharedFlow<List<TableModel>>(replay = 0)
    val tablesFreeFlow = _tablesFreeFlow.asSharedFlow()

    // ====== NEW: Payment flows ======

    private val _checkoutFlow = MutableSharedFlow<ReceiptResponse>(replay = 0)
    val checkoutFlow = _checkoutFlow.asSharedFlow()

    private val _orderTotalFlow = MutableStateFlow<Double?>(null)
    val orderTotalFlow = _orderTotalFlow.asSharedFlow()

    // ====== NEW: Thanh toán gộp bàn ======
    // Một bàn có thể có nhiều đơn PENDING/CONFIRMED cùng lúc (VD: khách gọi thêm món sau khi đơn đầu
    // đã CONFIRMED) — trước đây màn Checkout chỉ thấy đúng 1 orderId (this.orderId, đơn đầu tiên của
    // bàn), nên các đơn gọi thêm bị bỏ sót khỏi hoá đơn. Mirror đúng logic handleOpenCheckout/
    // handleConfirmPayment bên Web (App.jsx ~dòng 873-930): gom hết đơn PENDING+CONFIRMED của bàn,
    // cộng tổng tiền, hiện 1 hoá đơn duy nhất; lúc xác nhận thì tạo 1 log thanh toán cho tổng tiền
    // rồi loop cập nhật từng đơn sang COMPLETED.
    data class CheckoutSummary(val orderIds: List<String>, val totalAmount: Double, val orderCount: Int)

    private val _checkoutSummaryFlow = MutableStateFlow<CheckoutSummary?>(null)
    val checkoutSummaryFlow = _checkoutSummaryFlow.asStateFlow()

    val pageFlow = MutableStateFlow<PageMeta?>(null)
    private var currentPage = 0
    private var pageSize = 20
    private var pagingLoading = false

    var tableId: String? = null
        private set
    var orderId: String? = null
        private set

    fun setArguments(bundle: Bundle?) {
        tableId = bundle?.getString("tableId")
    }

    fun getDetailTable(token: String) {
        if (tableId == null) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = tableRepository.getTableByIdAndServer(token, tableId!!)
                if (response.isSuccess) {
                    orderId = response.data?.currentOrderId
                    _tableFlow.emit(response.data?.toTableModel() ?: error("Table data null"))

                    getOrderInfo(token)
                } else _errorFlow.emit(response.message ?: "Load failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun getCreateByOrder(token: String) {
        if (tableId == null) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = tableRepository.getCreateByOrder(token, tableId!!)
                if (response.isSuccess) _employeeOrderFlow.emit(response.data) else _errorFlow.emit(response.message ?: "Load failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    private fun getOrderInfo(token: String) {
        if (orderId == null) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.getOrder(token, orderId!!)
                if (response.isSuccess) {
                    val order = response.data ?: error("Order response null")
                    currentOrder = order
                    _orderFlow.emit(order)

                    val serverTotal = order.totalAmount ?: 0.0
                    val items = order.items ?: emptyList()
                    val computedTotal = items.sumOf { (it.price ?: 0.0) * ((it.quantity ?: 0).toDouble()) }
                    _orderTotalFlow.value = if (serverTotal > 0.0) serverTotal else computedTotal
                } else _errorFlow.emit(response.message ?: "Load failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun cancelOrder(context: Context, token: String) {
        if (orderId.isNullOrEmpty()) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.cancelOrder(token, orderId!!)
                if (response.isSuccess) {
                    // ✅ Tự động hoàn kho toàn bộ nguyên liệu đã trừ cho các món trong đơn vừa huỷ
                    refundStockForItems(context, token, currentOrder?.items ?: emptyList())
                    _cancelOrderFlow.emit(true)
                } else {
                    _errorFlow.emit(response.message ?: "Cancel failed")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    /**
     * Xác nhận đặt món: chuyển đơn PENDING -> CONFIRMED, đồng thời đẩy TẤT CẢ món trong đơn sang
     * COOKING ngay lập tức — bếp có đơn mới và bắt đầu nấu luôn, không cần thao tác nhận thủ công
     * từng món cho đơn đã xác nhận (đúng yêu cầu nghiệp vụ).
     *
     * Lưu ý về kho: nguyên liệu đã được validate + trừ kho ngay từ lúc THÊM từng món vào đơn (xem
     * FoodViewModel.addOrderItem) — món không đủ nguyên liệu sẽ không bao giờ vào được đơn để tới
     * đây, nên bước xác nhận này KHÔNG cần trừ/validate kho lại lần nữa.
     */
    fun confirmOrder(context: Context, token: String) {
        if (orderId.isNullOrEmpty()) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.confirmOrder(token, orderId!!)
                if (response.isSuccess) {
                    // Đọc cờ "Tự in khi vào bếp" 1 lần cho cả đơn — cùng cài đặt KDS mà tab Bếp dùng
                    // (SessionManager lưu chung, không phân biệt màn hình).
                    val autoPrint = SessionManager.getKdsSettings(context).autoPrintOnCooking
                    val order = currentOrder
                    val items = order?.items ?: emptyList()
                    for (item in items) {
                        val itemId = item.id ?: continue
                        try {
                            orderRepository.updateKitchenItemStatus(token, itemId, "COOKING")
                            // ✅ Món này vừa chính thức "vào bếp" — in phiếu ngay nếu bật tự in, cùng
                            // 1 hành vi với bếp bấm tay chuyển "Đang nấu" (xem KitchenViewModel).
                            if (autoPrint) {
                                val kitchenItem = KitchenItem(
                                    orderItemId = itemId,
                                    foodName = item.foodName ?: "Món",
                                    quantity = item.quantity ?: 1,
                                    note = item.note,
                                    kitchenStatus = "COOKING",
                                    orderId = order?.id ?: orderId!!,
                                    tableNumber = order?.tableNumber ?: "?"
                                )
                                runCatching { KitchenTicketPrinter.printTicket(context, kitchenItem) }
                            }
                        } catch (_: Exception) {
                            // best-effort từng món — 1 món lỗi không chặn các món còn lại
                        }
                    }
                    _confirmOrderFlow.emit(true)
                } else {
                    _errorFlow.emit(response.message ?: "Xác nhận đơn thất bại")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    /**
     * Hoàn kho best-effort cho danh sách món (dùng khi huỷ đơn hoặc xoá 1 món khỏi đơn). Bỏ qua
     * các dòng thiếu menuItemId/quantity hợp lệ. Không throw ra ngoài — nếu hoàn kho lỗi thì chấp
     * nhận lệch kho tạm thời, không chặn luồng huỷ đơn/xoá món chính (việc đó đã thành công rồi).
     */
    private suspend fun refundStockForItems(context: Context, token: String, items: List<OrderItem>) {
        val deductItems = items.mapNotNull { item ->
            val menuItemId = item.foodId
            val qty = item.quantity
            if (!menuItemId.isNullOrBlank() && qty != null && qty > 0) {
                DeductStockItem(menuItemId = menuItemId, quantity = qty)
            } else null
        }
        if (deductItems.isEmpty()) return
        try {
            catalogRepository.refundStock(context, token, DeductStockRequest(items = deductItems))
        } catch (_: Exception) {
            // best-effort — xem docstring ở trên
        }
    }

    fun completeOrder(token: String) {
        if (orderId.isNullOrEmpty()) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.complete(token, orderId!!)
                if (response.isSuccess) _completedOrderFlow.emit(orderId!!) else _errorFlow.emit(response.message ?: "Complete failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun listOrders(token: String, page: Int = 0, size: Int = 20, reset: Boolean = true) {
        internalLoadOrders(token, page, size, reset)
    }

    fun refresh(token: String, size: Int = 20) {
        pageSize = size
        currentPage = 0
        internalLoadOrders(token, page = 0, size = pageSize, reset = true)
    }

    fun loadNext(token: String) {
        val meta = pageFlow.value ?: return
        val next = meta.number + 1
        if (next >= meta.totalPages) return
        internalLoadOrders(token, page = next, size = meta.size, reset = false)
    }

    private fun internalLoadOrders(token: String, page: Int, size: Int, reset: Boolean) {
        if (pagingLoading) return
        pagingLoading = true
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.listOrders(token = token, page = page, size = size)
                if (response.isSuccess) {
                    pageFlow.value = response.page
                    currentPage = page
                    pageSize = size
                    val list = response.data ?: emptyList()
                    _listOrderFlow.value =
                        if (reset) list.map { it.data } else _listOrderFlow.value + list.map { it.data }
                } else _errorFlow.emit(response.message ?: "Load failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.emit(false)
                pagingLoading = false
            }
        }
    }

    fun removeItemFromOrder(context: Context, token: String, foodId: String, quantity: Int) {
        if (orderId.isNullOrEmpty()) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = orderRepository.removeItemFromOrder(token, orderId!!, foodId)
                if (response.isSuccess) {
                    // ✅ Tự động hoàn kho phần nguyên liệu đã trừ cho món vừa xoá khỏi đơn
                    refundStockForItems(context, token, listOf(OrderItem(foodId = foodId, quantity = quantity)))
                    _removeItemFromOrderFlow.emit(true)
                } else {
                    _errorFlow.emit(response.message ?: "Remove failed")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun getTablesFromServer(token: String) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = tableRepository.getTablesFreeFromServer(token)
                if (response.isSuccess) _tablesFreeFlow.emit(response.data?.map { it.toTableModel() } ?: emptyList())
                else _errorFlow.emit(response.message ?: "Load failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun copyTableOrder(token: String, targetTableId: String) {
        if (tableId == null) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val request = CopyItemsRequest(sourceTableId = tableId!!, targetTableId = targetTableId)
                val response = tableRepository.copyTableOrder(token, request)
                if (response.isSuccess) _copyOrderFlow.emit(true) else _errorFlow.emit(response.message ?: "Copy failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    // ====== NEW: Gom tất cả đơn PENDING/CONFIRMED của bàn hiện tại để thanh toán 1 lần ======
    fun loadCheckoutSummary(token: String) {
        if (tableId == null) return
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                // Lấy song song 2 trạng thái, giống pattern KitchenViewModel.fetchKitchenItems()
                val pendingDeferred = async { orderRepository.listOrders(token, "PENDING") }
                val confirmedDeferred = async { orderRepository.listOrders(token, "CONFIRMED") }

                val pendingRes = pendingDeferred.await()
                val confirmedRes = confirmedDeferred.await()

                val pendingOrders = if (pendingRes.isSuccess) pendingRes.data ?: emptyList() else emptyList()
                val confirmedOrders = if (confirmedRes.isSuccess) confirmedRes.data ?: emptyList() else emptyList()

                val tableOrders = (pendingOrders + confirmedOrders).filter { it.tableId == tableId }

                if (tableOrders.isEmpty()) {
                    _checkoutSummaryFlow.value = null
                    _errorFlow.emit("Bàn này không có đơn hàng nào cần thanh toán")
                    return@launch
                }

                val ids = tableOrders.mapNotNull { it.id }
                val total = tableOrders.sumOf { it.totalAmount ?: 0.0 }
                _checkoutSummaryFlow.value = CheckoutSummary(
                    orderIds = ids,
                    totalAmount = total,
                    orderCount = tableOrders.size
                )
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    // ====== NEW: Payment actions (thanh toán gộp — 1 log payment cho tổng tiền + loop COMPLETED) ======
    fun checkout(token: String, payload: CheckoutRequest) {
        val summary = _checkoutSummaryFlow.value
        val orderIds = summary?.orderIds?.takeIf { it.isNotEmpty() }
            ?: orderId?.let { listOf(it) } // fallback: chưa gọi loadCheckoutSummary(), dùng đơn hiện tại như trước
        if (orderIds.isNullOrEmpty()) {
            viewModelScope.launch { _errorFlow.emit("Không có đơn hàng để thanh toán") }
            return
        }
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                // 1. Tạo 1 payment request duy nhất để lưu log cho TỔNG tiền của tất cả đơn thuộc bàn
                //    này (đúng logic handleConfirmPayment bên Web — gọi payment.create 1 lần, không
                //    phải từng đơn). Dùng orderIds đầu tiên làm orderId đại diện vì payment-service
                //    yêu cầu đúng 1 orderId, chưa có API "thanh toán gộp nhiều đơn" ở tầng BE.
                val paymentPayload = mapOf(
                    "orderId" to orderIds.first(),
                    "amount" to payload.amountReceived,
                    "method" to payload.paymentMethod,
                    "note" to (payload.note ?: "")
                )
                orderRepository.createPayment(token, paymentPayload)

                // 2. Loop cập nhật TỪNG đơn của bàn sang COMPLETED (đúng vòng lặp
                //    handleUpdateOrderStatus bên Web) — không dừng giữa chừng nếu 1 đơn lỗi, cố gắng
                //    cập nhật hết các đơn còn lại rồi mới báo lỗi tổng hợp.
                var failedCount = 0
                for (id in orderIds) {
                    val res = orderRepository.complete(token, id)
                    if (!res.isSuccess) failedCount++
                }

                if (failedCount == 0) {
                    _checkoutFlow.emit(
                        ReceiptResponse(
                            code = "200",
                            message = "Success",
                            data = Receipt(
                                orderId = orderIds.first(),
                                tableId = tableId ?: "",
                                subtotal = payload.amountReceived,
                                discount = payload.discount ?: 0.0,
                                total = payload.amountReceived,
                                paymentMethod = payload.paymentMethod,
                                amountReceived = payload.amountReceived,
                                change = 0.0,
                                paidAtEpochMs = System.currentTimeMillis()
                            )
                        )
                    )
                    _checkoutSummaryFlow.value = null
                } else {
                    _errorFlow.emit(
                        "Đã ghi nhận thanh toán nhưng $failedCount/${orderIds.size} đơn cập nhật trạng thái thất bại — kiểm tra lại đơn của bàn này."
                    )
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }
}
