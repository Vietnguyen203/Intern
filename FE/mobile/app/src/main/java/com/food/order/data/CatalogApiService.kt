package com.food.order.data

import com.food.order.data.model.ApiResponse
import com.food.order.data.request.CategoryRequest
import com.food.order.data.request.MenuItemRequest
import com.food.order.data.response.CategoryResponse
import com.food.order.data.response.MenuItemResponse
import retrofit2.http.*

interface CatalogApiService {

    // ===== INVENTORY =====
    @GET("catalog-service/inventory/ingredients")
    suspend fun getIngredients(
        @Header("Authorization") token: String
    ): ApiResponse<List<com.food.order.data.response.IngredientResponse>>

    @POST("catalog-service/inventory/ingredients")
    suspend fun createIngredient(
        @Header("Authorization") token: String,
        @Body request: com.food.order.data.request.IngredientRequest
    ): ApiResponse<com.food.order.data.response.IngredientResponse>

    @PUT("catalog-service/inventory/ingredients/{id}")
    suspend fun updateIngredient(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: com.food.order.data.request.IngredientRequest
    ): ApiResponse<com.food.order.data.response.IngredientResponse>

    @POST("catalog-service/inventory/transactions/import")
    suspend fun importStock(
        @Header("Authorization") token: String,
        @Body request: com.food.order.data.request.StockTransactionRequest
    ): ApiResponse<com.food.order.data.response.TransactionResponse>

    @POST("catalog-service/inventory/transactions/export")
    suspend fun exportStock(
        @Header("Authorization") token: String,
        @Body request: com.food.order.data.request.StockTransactionRequest
    ): ApiResponse<com.food.order.data.response.TransactionResponse>

    @GET("catalog-service/inventory/transactions")
    suspend fun getTransactions(
        @Header("Authorization") token: String
    ): ApiResponse<List<com.food.order.data.response.TransactionResponse>>

    // ✅ Trừ kho khi order thêm món — validate đủ nguyên liệu cho ĐỦ số lượng yêu cầu, chặn ngay
    // nếu kho không đủ (BE trả 400 kèm message chi tiết tên nguyên liệu/số lượng thiếu).
    @POST("catalog-service/inventory/deduct")
    suspend fun deductStock(
        @Header("Authorization") token: String,
        @Body request: com.food.order.data.request.DeductStockRequest
    ): ApiResponse<Void>

    // ✅ Hoàn kho khi huỷ món / huỷ đơn (hoặc để bù trừ khi 1 bước sau deduct bị lỗi giữa chừng)
    @POST("catalog-service/inventory/refund")
    suspend fun refundStock(
        @Header("Authorization") token: String,
        @Body request: com.food.order.data.request.DeductStockRequest
    ): ApiResponse<Void>

    // ===== CATEGORIES =====
    @GET("catalog-service/categories")
    suspend fun getCategories(
        @Header("Authorization") token: String
    ): ApiResponse<List<CategoryResponse>>

    @GET("catalog-service/categories/{id}")
    suspend fun getCategoryById(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<CategoryResponse>

    @POST("catalog-service/categories")
    suspend fun createCategory(
        @Header("Authorization") token: String,
        @Body request: CategoryRequest
    ): ApiResponse<CategoryResponse>

    @PUT("catalog-service/categories/{id}")
    suspend fun updateCategory(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: CategoryRequest
    ): ApiResponse<CategoryResponse>

    @DELETE("catalog-service/categories/{id}")
    suspend fun deleteCategory(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<Void>

    // ===== MENU ITEMS =====
    @GET("catalog-service/items")
    suspend fun getMenuItems(
        @Header("Authorization") token: String,
        @Query("categoryId") categoryId: String? = null
    ): ApiResponse<List<MenuItemResponse>>

    @GET("catalog-service/items/{id}")
    suspend fun getMenuItemById(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<MenuItemResponse>

    @POST("catalog-service/items")
    suspend fun createMenuItem(
        @Header("Authorization") token: String,
        @Body request: MenuItemRequest
    ): ApiResponse<MenuItemResponse>

    @PUT("catalog-service/items/{id}")
    suspend fun updateMenuItem(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body request: MenuItemRequest
    ): ApiResponse<MenuItemResponse>

    @DELETE("catalog-service/items/{id}")
    suspend fun deleteMenuItem(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): ApiResponse<Void>
}
