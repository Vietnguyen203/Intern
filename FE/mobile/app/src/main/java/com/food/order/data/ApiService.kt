package com.food.order.data

import com.food.order.data.model.ApiResponse
import com.food.order.data.remote.PagedOrders
import com.food.order.data.request.*
import com.food.order.data.response.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ===== USERS / AUTH =====
    @POST("api/users-service/login")
    suspend fun login(@Body request: LoginRequest): TokenResponse

    // public register (dùng ở RegisterDialogFragment)
    // BE controller is /users/register
    @POST("api/users-service")
    suspend fun registerPublic(@Body body: Map<String, @JvmSuppressWildcards Any>): ApiResponse<TokenResponse>

    @POST("api/users-service/forgot-password")
    suspend fun forgotPassword(@Body body: Map<String, String>): ApiResponse<Any>

    @PUT("api/users-service/reset-password")
    suspend fun resetPassword(@Body body: Map<String, String>): ApiResponse<Any>

    // register qua flow nội bộ (Admin tạo staff)
    @POST("api/users-service")
    suspend fun register(
        @Header("Authorization") token: String,
        @Body request: RegisterRequest
    ): ApiResponse<TokenResponse>

    @GET("api/users-service/getInfo")
    suspend fun getInfo(@Header("Authorization") token: String): ApiResponse<UserResponse>

    // ===== STAFF (JWT) =====
    @GET("api/users-service")
    suspend fun getUsersFromServer(
        @Header("Authorization") token: String,
        @Query("server") server: String
    ): ListUserResponse

    @GET("api/users-service/count-by-server")
    suspend fun getCountEmployee(
        @Header("Authorization") token: String,
        @Query("server") server: String
    ): SimpleLongResponse

    @PUT("api/users-service/{employeeId}")
    suspend fun updateUserFromServer(
        @Header("Authorization") token: String,
        @Path("employeeId") employeeId: String,
        @Body request: UpdateStaffRequest
    ): SimpleResponse

    @DELETE("api/users-service/{employeeId}")
    suspend fun deleteUserFromServer(
        @Header("Authorization") token: String,
        @Path("employeeId") employeeId: String
    ): SimpleResponse

    // ===== FILES =====
    @Multipart
    @POST("files/upload")
    suspend fun uploadImage(@Part file: MultipartBody.Part): ApiResponse<FileUploadResponse>

    // ===== FOODS =====
    @GET("foods/list")
    suspend fun getFoodsFromServer(@Header("Authorization") token: String): ApiResponse<List<FoodResponse>>

    @POST("foods/create")
    suspend fun createFood(
        @Header("Authorization") token: String,
        @Body request: FoodRequest
    ): ApiResponse<FoodResponse>

    @PUT("foods/{id}")
    suspend fun updateFood(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: FoodRequest
    ): ApiResponse<FoodResponse>

    @DELETE("foods/{id}")
    suspend fun deleteFood(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<Void>

    @GET("foods/{id}")
    suspend fun getFoodById(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<FoodResponse>

    @GET("foods/categories")
    suspend fun getCategories(
        @Header("Authorization") token: String
    ): ApiResponse<List<String>>

    // ===== TABLES =====
    @GET("api/tables")
    suspend fun getTablesFromServer(@Header("Authorization") token: String): ApiResponse<List<TableResponse>>

    @GET("api/tables?status=AVAILABLE")
    suspend fun getTablesFreeFromServer(@Header("Authorization") token: String): ApiResponse<List<TableResponse>>

    @POST("api/tables")
    suspend fun createTable(
        @Header("Authorization") token: String,
        @Body request: TableRequest
    ): ApiResponse<TableResponse>

    @PUT("api/tables/{id}")
    suspend fun updateTable(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: TableRequest
    ): ApiResponse<TableResponse>

    @DELETE("api/tables/{id}")
    suspend fun deleteTable(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<Void>

    @GET("api/tables/{tableId}")
    suspend fun getTableByIdAndServer(
        @Header("Authorization") token: String,
        @Path("tableId") id: String
    ): ApiResponse<TableResponse>

    // ===== TABLE RESERVATIONS (đặt bàn trước theo ngày/giờ — khác với "book now"/bookTable ở
    // DashboardViewModel, vốn chỉ là mở bàn ngay lập tức) =====
    @GET("api/tables/reservations/available")
    suspend fun getAvailableTablesForReservation(
        @Header("Authorization") token: String,
        @Query("reservedAt") reservedAt: String,
        @Query("partySize") partySize: Int
    ): ApiResponse<List<AvailableTableResponse>>

    @POST("api/tables/reservations/public")
    suspend fun createReservationPublic(
        @Header("Authorization") token: String,
        @Body request: ReservationCreateRequest
    ): ApiResponse<ReservationResponse>

    @GET("api/tables/reservations")
    suspend fun getReservations(
        @Header("Authorization") token: String,
        @Query("from") from: String,
        @Query("to") to: String
    ): ApiResponse<List<ReservationResponse>>

    @DELETE("api/tables/reservations/{id}")
    suspend fun cancelReservation(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<ReservationResponse>


    @GET("order/orders/tables/{tableId}/creator")
    suspend fun getCreateByOrder(
        @Header("Authorization") token: String,
        @Path("tableId") id: String
    ): ApiResponse<EmployeeOrderResponse>

    @POST("tables/copy-items")
    suspend fun copyTableOrder(
        @Header("Authorization") token: String,
        @Body request: CopyItemsRequest
    ): ApiResponse<Void>

    // ===== ORDERS (core) =====
    @GET("order/orders/{id}")
    suspend fun getOrder(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<OrderResponse>

    @GET("order/orders")
    suspend fun listOrders(
        @Header("Authorization") token: String,
        @Query("status") status: String? = null,
        @Query("page") page: Int? = null,
        @Query("size") size: Int? = null
    ): ApiResponse<List<OrderResponse>>

    @POST("order/orders")
    suspend fun createOrder(
        @Header("Authorization") token: String,
        @Body request: OrderRequest
    ): ApiResponse<OrderResponse>

    @DELETE("order/orders/{id}")
    suspend fun cancelOrder(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<Void>

    @PATCH("order/orders/{id}/status")
    suspend fun complete(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Query("status") status: String = "COMPLETED"
    ): ApiResponse<Void>

    // ===== ORDER ITEMS =====
    @POST("order/orders/{id}/items")
    suspend fun addOrderItem(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: AddOrderItemRequest
    ): ApiResponse<Void>

    @PUT("order/orders/{id}/items/{foodId}")
    suspend fun updateOrderItem(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Path("foodId") foodId: String,
        @Body request: UpdateOrderItemRequest
    ): ApiResponse<Void>

    @DELETE("order/orders/{id}/items/{foodId}")
    suspend fun removeItemFromOrder(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Path("foodId") foodId: String
    ): ApiResponse<Void>

    @PUT("orders/{id}/waiter")
    suspend fun updateWaiter(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: Map<String, String>
    ): ApiResponse<Void>

    // ===== REPORTS (JWT) =====
    @GET("order/orders/list")
    suspend fun getListOrderInTime(
        @Header("Authorization") token: String,
        @Query("time") time: String? = null,
        @Query("server") server: String? = null
    ): ApiResponse<List<OrderResponse>>

    @GET("order/orders/most-favorite-food")
    suspend fun getMostFavoriteFood(
        @Header("Authorization") token: String,
        @Query("time") time: String? = null,
        @Query("server") server: String? = null
    ): ApiResponse<MostFavoriteFoodResponse>

    @GET("order/reports")
    suspend fun getReports(
        @Header("Authorization") token: String,
        @Query("type") type: String,
        @Query("server") server: String? = null
    ): ApiResponse<List<com.food.order.data.response.ReportData>>

    // ===== ORDER HISTORY (JWT) =====
    @GET("order/orders")
    suspend fun getOrders(
        @Header("Authorization") token: String,
        @Query("page") page: Int,
        @Query("size") size: Int
    ): Response<ApiResponse<PagedOrders>>

    // ===== PAYMENT =====
    @POST("payment/api/payments")
    suspend fun createPayment(
        @Header("Authorization") token: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): ApiResponse<Void>

    @PUT("orders/{id}/checkout")
    suspend fun checkoutOrder(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: CheckoutRequest
    ): ApiResponse<ReceiptResponse>

    // ===== STATISTICS =====
    @GET("statistics/food-distribution")
    suspend fun getFoodDistribution(
        @Header("Authorization") token: String,
        @Query("server") server: String? = null,
        @Query("type") type: String = "day",
        @Query("date") date: String? = null
    ): ApiResponse<FoodStatisticsResponse>
    // ===== KITCHEN =====
    @GET("order/orders?status=PENDING")
    suspend fun getKitchenItems(@Header("Authorization") token: String): ApiResponse<List<OrderResponse>>

    @PATCH("order/orders/items/{orderItemId}/kitchen-status")
    suspend fun updateKitchenItemStatus(
        @Header("Authorization") token: String,
        @Path("orderItemId") orderItemId: String,
        @Query("status") status: String
    ): ApiResponse<Void>

    // ===== NOTIFICATIONS =====
    @GET("api/notifications/recent")
    suspend fun getRecentNotifications(
        @Header("Authorization") token: String,
        @Query("role") role: String
    ): ApiResponse<List<NotificationResponse>>

    @PATCH("api/notifications/{id}/read")
    suspend fun markNotificationRead(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<NotificationResponse>

    @POST("api/notifications/device-token")
    suspend fun registerFcmToken(
        @Header("Authorization") token: String,
        @Body body: Map<String, @JvmSuppressWildcards String>
    ): ApiResponse<Void>

    @DELETE("api/notifications/device-token")
    suspend fun removeFcmToken(
        @Header("Authorization") token: String,
        @Body body: Map<String, @JvmSuppressWildcards String>
    ): ApiResponse<Void>
}
