package com.food.order.data.repository

import com.food.order.data.ApiService
import com.food.order.data.RetrofitClient
import com.food.order.data.model.ApiResponse
import com.food.order.data.request.ReservationCreateRequest
import com.food.order.data.response.AvailableTableResponse
import com.food.order.data.response.ReservationResponse

object ReservationRepository {

    private val api: ApiService
        get() = RetrofitClient.instance

    suspend fun getAvailableTables(token: String, reservedAtIso: String, partySize: Int): ApiResponse<List<AvailableTableResponse>> =
        api.getAvailableTablesForReservation(token, reservedAtIso, partySize)

    suspend fun createReservation(token: String, request: ReservationCreateRequest): ApiResponse<ReservationResponse> =
        api.createReservationPublic(token, request)

    suspend fun getReservations(token: String, from: String, to: String): ApiResponse<List<ReservationResponse>> =
        api.getReservations(token, from, to)

    suspend fun cancelReservation(token: String, id: String): ApiResponse<ReservationResponse> =
        api.cancelReservation(token, id)
}
