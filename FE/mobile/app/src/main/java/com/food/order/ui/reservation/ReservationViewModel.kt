package com.food.order.ui.reservation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.food.order.data.ApiError
import com.food.order.data.mapper.toReservationModel
import com.food.order.data.model.ReservationModel
import com.food.order.data.repository.ReservationRepository
import com.food.order.data.request.ReservationCreateRequest
import com.food.order.data.response.AvailableTableResponse
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ReservationViewModel : ViewModel() {

    private val repository = ReservationRepository

    private val _loadingFlow = MutableSharedFlow<Boolean>(replay = 0)
    val loadingFlow = _loadingFlow.asSharedFlow()

    private val _errorFlow = MutableSharedFlow<String>(replay = 0)
    val errorFlow = _errorFlow.asSharedFlow()

    private val _reservationsFlow = MutableStateFlow<List<ReservationModel>>(emptyList())
    val reservationsFlow: StateFlow<List<ReservationModel>> = _reservationsFlow.asStateFlow()

    private val _cancelFlow = MutableSharedFlow<Boolean>(replay = 0)
    val cancelFlow = _cancelFlow.asSharedFlow()

    private val _availableTablesFlow = MutableStateFlow<List<AvailableTableResponse>>(emptyList())
    val availableTablesFlow: StateFlow<List<AvailableTableResponse>> = _availableTablesFlow.asStateFlow()

    private val _createFlow = MutableSharedFlow<Boolean>(replay = 0)
    val createFlow = _createFlow.asSharedFlow()

    fun getReservations(token: String, fromIso: String, toIso: String) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val res = repository.getReservations(token, fromIso, toIso)
                if (res.isSuccess) {
                    _reservationsFlow.value = res.data?.map { it.toReservationModel() } ?: emptyList()
                } else {
                    _errorFlow.emit(res.message ?: "Không tải được danh sách đặt bàn")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.emit(false)
            }
        }
    }

    fun cancelReservation(token: String, id: String, fromIso: String, toIso: String) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val res = repository.cancelReservation(token, id)
                if (res.isSuccess) {
                    _cancelFlow.emit(true)
                    getReservations(token, fromIso, toIso) // reload danh sách sau khi huỷ
                } else {
                    _errorFlow.emit(res.message ?: "Huỷ đặt bàn thất bại")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.emit(false)
            }
        }
    }

    fun findAvailableTables(token: String, reservedAtIso: String, partySize: Int) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val res = repository.getAvailableTables(token, reservedAtIso, partySize)
                if (res.isSuccess) {
                    val list = res.data ?: emptyList()
                    _availableTablesFlow.value = list
                    if (list.isEmpty()) _errorFlow.emit("Không có bàn trống phù hợp cho khung giờ này")
                } else {
                    _errorFlow.emit(res.message ?: "Không tìm được bàn trống")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.emit(false)
            }
        }
    }

    fun createReservation(token: String, request: ReservationCreateRequest) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val res = repository.createReservation(token, request)
                if (res.isSuccess) {
                    _createFlow.emit(true)
                } else {
                    _errorFlow.emit(res.message ?: "Đặt bàn thất bại")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                _loadingFlow.emit(false)
            }
        }
    }
}
