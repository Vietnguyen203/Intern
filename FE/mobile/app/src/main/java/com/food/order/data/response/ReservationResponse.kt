package com.food.order.data.response

import com.google.gson.annotations.SerializedName
import java.io.Serializable

// Khớp JSON trả về từ table-service (TableReservation entity, serialize trực tiếp — camelCase,
// giống hệt quy ước đang dùng cho TableResponse.kt, không phải snake_case).
data class ReservationResponse(
    @SerializedName("id")              val id: String? = null,
    @SerializedName("tableId")         val tableId: String? = null,
    @SerializedName("tableNumber")     val tableNumber: Int? = null,
    @SerializedName("customerName")    val customerName: String? = null,
    @SerializedName("customerPhone")   val customerPhone: String? = null,
    @SerializedName("partySize")       val partySize: Int? = null,
    @SerializedName("reservedAt")      val reservedAt: String? = null,
    @SerializedName("durationMinutes") val durationMinutes: Int? = null,
    @SerializedName("status")          val status: String? = null
) : Serializable

// Bàn trống trả về từ GET /tables/reservations/available (RestaurantTable entity, serialize trực
// tiếp) — field khác với TableResponse.kt vì entity này có "capacity", không có "table_name".
data class AvailableTableResponse(
    @SerializedName("id")             val id: String? = null,
    @SerializedName("tableNumber")    val tableNumber: Int? = null,
    @SerializedName("capacity")       val capacity: Int? = null,
    @SerializedName("status")         val status: String? = null
) : Serializable
