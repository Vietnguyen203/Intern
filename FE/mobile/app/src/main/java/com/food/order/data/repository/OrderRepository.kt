package com.food.order.data.repository

import com.food.order.data.ApiService
import com.food.order.data.RetrofitClient
import com.food.order.data.model.ApiResponse
import com.food.order.data.remote.PagedOrders
import com.food.order.data.request.*
import com.food.order.data.response.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn

object OrderRepository {

    private val api get() = RetrofitClient.instance

    // ====== ORDER CORE ======
    suspend fun getOrder(token: String, id: String): ApiResponse<OrderResponse> =
        api.getOrder(token, id)

    suspend fun listOrders(token: String, status: String? = null, page: Int? = null, size: Int? = null): ApiResponse<List<OrderResponse>> =
        api.listOrders(token, status, page, size)

    suspend fun createOrder(token: String, request: OrderRequest): ApiResponse<OrderResponse> =
        api.createOrder(token, request)

    suspend fun cancelOrder(token: String, id: String): ApiResponse<Void> =
        api.cancelOrder(token, id)

    suspend fun complete(token: String, id: String): ApiResponse<Void> =
        api.complete(token, id, "COMPLETED")

    // ✅ Xác nhận đặt món: PENDING -> CONFIRMED. Dùng chung endpoint với complete() vì cùng là
    // "PATCH order/orders/{id}/status?status=..." — chỉ khác giá trị status truyền vào.
    suspend fun confirmOrder(token: String, id: String): ApiResponse<Void> =
        api.complete(token, id, "CONFIRMED")

    // ====== ORDER ITEMS ======
    suspend fun addOrderItem(token: String, id: String, request: AddOrderItemRequest): ApiResponse<Void> =
        api.addOrderItem(token, id, request)

    suspend fun updateOrderItem(token: String, id: String, request: UpdateOrderItemRequest): ApiResponse<Void> =
        api.updateOrderItem(token, id, request.foodId, request)

    suspend fun removeItemFromOrder(token: String, id: String, foodId: String): ApiResponse<Void> =
        api.removeItemFromOrder(token, id, foodId)

    suspend fun updateWaiter(token: String, id: String, waiterId: String): ApiResponse<Void> {
        return api.updateWaiter(token, id, mapOf("waiterId" to waiterId))
    }

    // ====== REPORTS (SECURED) ======
    suspend fun getMostFavoriteFood(
        token: String,
        time: String? = null,
        server: String? = null
    ): ApiResponse<MostFavoriteFoodResponse> =
        api.getMostFavoriteFood(token, time, server)

    suspend fun getReports(
        token: String,
        type: String,
        server: String? = null
    ): ApiResponse<List<com.food.order.data.response.ReportData>> =
        api.getReports(token, type, server)

    suspend fun getListOrderInTime(
        token: String,
        time: String? = null,
        server: String? = null
    ): ApiResponse<List<OrderResponse>> =
        api.getListOrderInTime(token, time, server)

    // ====== TABLE HELPERS ======
    suspend fun getCreateByOrder(token: String, tableId: String): ApiResponse<EmployeeOrderResponse> =
        api.getCreateByOrder(token, tableId)

    suspend fun copyTableOrder(token: String, request: CopyItemsRequest): ApiResponse<Void> =
        api.copyTableOrder(token, request)

    // ====== PAYMENT ======
    suspend fun createPayment(token: String, request: Map<String, Any>): ApiResponse<Void> =
        api.createPayment(token, request)

    suspend fun checkoutOrder(token: String, id: String, request: CheckoutRequest): ApiResponse<ReceiptResponse> =
        api.checkoutOrder(token, id, request)

    // ====== ORDER HISTORY (PAGING) ======
    fun getOrderHistory(
        token: String,
        page: Int,
        size: Int
    ) = flow {
        val response = api.getOrders(token, page, size)
        if (!response.isSuccessful) throw Exception("Network error: ${response.code()}")

        val apiRes = response.body() ?: throw Exception("Body null")
        if (!apiRes.isSuccess) throw Exception(apiRes.message ?: "Load failed")

        val pagedData = apiRes.data ?: PagedOrders(emptyList()) // PagedOrders has orders field
        val meta = apiRes.page ?: error("Missing page meta")

        emit(pagedData.orders to meta)
    }
    // ====== KITCHEN ======
    suspend fun getKitchenItems(token: String): ApiResponse<List<OrderResponse>> =
        api.getKitchenItems(token)

    suspend fun updateKitchenItemStatus(token: String, orderItemId: String, status: String): ApiResponse<Void> =
        api.updateKitchenItemStatus(token, orderItemId, status)
}
