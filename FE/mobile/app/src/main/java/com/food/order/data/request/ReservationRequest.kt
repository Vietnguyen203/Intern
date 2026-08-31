package com.food.order.data.request

import com.google.gson.annotations.SerializedName

// Khớp field-for-field với ReservationRequest.java bên table-service (application/dto).
data class ReservationCreateRequest(
    @SerializedName("tableId")       val tableId: String,
    @SerializedName("customerName")  val customerName: String,
    @SerializedName("customerPhone") val customerPhone: String?,
    @SerializedName("partySize")     val partySize: Int,
    // ISO local date-time không kèm timezone, vd "2026-08-28T19:30:00" — khớp @DateTimeFormat(iso =
    // DATE_TIME) / LocalDateTime bên BE.
    @SerializedName("reservedAt")    val reservedAt: String
)
