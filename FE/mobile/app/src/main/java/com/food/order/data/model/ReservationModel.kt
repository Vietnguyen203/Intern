package com.food.order.data.model

import java.io.Serializable

data class ReservationModel(
    val id: String,
    val tableLabel: String,
    val customerName: String,
    val customerPhone: String,
    val partySize: Int,
    val reservedAtDisplay: String,
    val status: String
) : Serializable

data class AvailableTableModel(
    val id: String,
    val tableNumber: Int,
    val capacity: Int
) : Serializable
