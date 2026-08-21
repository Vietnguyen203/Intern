package com.food.order.data.repository

import android.content.Context
import com.food.order.data.CatalogRetrofitClient
import com.food.order.data.model.ApiResponse
import com.food.order.data.request.CategoryRequest
import com.food.order.data.request.DeductStockRequest
import com.food.order.data.request.MenuItemRequest
import com.food.order.data.response.CategoryResponse
import com.food.order.data.response.MenuItemResponse

object CatalogRepository {

    private fun api(ctx: Context) = CatalogRetrofitClient.build(ctx)

    // ===== INVENTORY: TRỪ KHO / HOÀN KHO (order thêm món / huỷ món, huỷ đơn) =====

    suspend fun deductStock(ctx: Context, token: String, request: DeductStockRequest): ApiResponse<Void> {
        return api(ctx).deductStock(token, request)
    }

    suspend fun refundStock(ctx: Context, token: String, request: DeductStockRequest): ApiResponse<Void> {
        return api(ctx).refundStock(token, request)
    }

    // ===== CATEGORIES =====

    suspend fun getCategories(ctx: Context, token: String): ApiResponse<List<CategoryResponse>> {
        return api(ctx).getCategories(token)
    }

    suspend fun getCategoryById(ctx: Context, token: String, id: String): ApiResponse<CategoryResponse> {
        return api(ctx).getCategoryById(token, id)
    }

    suspend fun createCategory(ctx: Context, token: String, request: CategoryRequest): ApiResponse<CategoryResponse> {
        return api(ctx).createCategory(token, request)
    }

    suspend fun updateCategory(ctx: Context, token: String, id: String, request: CategoryRequest): ApiResponse<CategoryResponse> {
        return api(ctx).updateCategory(token, id, request)
    }

    suspend fun deleteCategory(ctx: Context, token: String, id: String): ApiResponse<Void> {
        return api(ctx).deleteCategory(token, id)
    }

    // ===== MENU ITEMS =====

    suspend fun getMenuItems(ctx: Context, token: String, categoryId: String? = null): ApiResponse<List<MenuItemResponse>> {
        return api(ctx).getMenuItems(token, categoryId)
    }

    suspend fun getMenuItemById(ctx: Context, token: String, id: String): ApiResponse<MenuItemResponse> {
        return api(ctx).getMenuItemById(token, id)
    }

    suspend fun createMenuItem(ctx: Context, token: String, request: MenuItemRequest): ApiResponse<MenuItemResponse> {
        return api(ctx).createMenuItem(token, request)
    }

    suspend fun updateMenuItem(ctx: Context, token: String, id: String, request: MenuItemRequest): ApiResponse<MenuItemResponse> {
        return api(ctx).updateMenuItem(token, id, request)
    }

    suspend fun deleteMenuItem(ctx: Context, token: String, id: String): ApiResponse<Void> {
        return api(ctx).deleteMenuItem(token, id)
    }
}
