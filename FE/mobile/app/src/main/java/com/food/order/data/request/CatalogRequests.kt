package com.food.order.data.request

import com.google.gson.annotations.SerializedName

data class CategoryRequest(
    @SerializedName("code")        val code: String,
    @SerializedName("name")        val name: String,
    @SerializedName("description") val description: String? = null
)

data class MenuItemRequest(
    @SerializedName("code")       val code: String,
    @SerializedName("foodName")   val foodName: String,
    @SerializedName("price")      val price: Double,
    @SerializedName("categoryId") val categoryId: String,
    @SerializedName("imageUrl")   val imageUrl: String? = null
)

// ===== Trừ kho / hoàn kho khi order (mirror DeductStockRequest.java bên catalog-service) =====
// Lưu ý: field name phải khớp CHÍNH XÁC camelCase với JSON — CatalogRetrofitClient dùng
// FieldNamingPolicy.IDENTITY (không tự chuyển snake_case).
data class DeductStockItem(
    @SerializedName("menuItemId") val menuItemId: String,
    @SerializedName("quantity")   val quantity: Int
)

data class DeductStockRequest(
    @SerializedName("items") val items: List<DeductStockItem>
)
