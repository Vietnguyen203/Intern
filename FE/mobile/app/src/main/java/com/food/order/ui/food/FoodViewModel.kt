package com.food.order.ui.food

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.food.order.data.ApiError
import com.food.order.data.mapper.toFoodModel
import com.food.order.data.model.FoodModel
import com.food.order.data.model.ApiResponse
import com.food.order.data.repository.CatalogRepository
import com.food.order.data.repository.FileRepository
import com.food.order.data.repository.OrderRepository
import com.food.order.data.request.AddOrderItemRequest
import com.food.order.data.request.DeductStockItem
import com.food.order.data.request.DeductStockRequest
import com.food.order.data.request.MenuItemRequest
import com.food.order.data.response.CategoryResponse
import com.food.order.data.response.MenuItemResponse
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

class FoodViewModel : ViewModel() {

    private val fileRepository = FileRepository
    private val catalogRepository = CatalogRepository
    private val orderRepository = OrderRepository

    private val _imageUriFlow = MutableSharedFlow<Uri?>(replay = 0)
    val imageUriFlow = _imageUriFlow.asSharedFlow()

    private val _loadingFlow = MutableSharedFlow<Boolean>(replay = 0)
    val loadingFlow = _loadingFlow.asSharedFlow()

    private val _errorFlow = MutableSharedFlow<String>(replay = 0)
    val errorFlow = _errorFlow.asSharedFlow()

    // Emit List<MenuItemResponse> (catalog) → Fragment map sang FoodModel
    private val _menuItemsFlow = MutableSharedFlow<List<MenuItemResponse>>(replay = 0)
    val menuItemsFlow = _menuItemsFlow.asSharedFlow()

    // Giữ lại foodsFlow để FoodFragment không cần đổi tên flow
    private val _foodsFlow = MutableSharedFlow<List<FoodModel>>(replay = 0)
    val foodsFlow = _foodsFlow.asSharedFlow()

    private val _categoriesFlow = MutableSharedFlow<List<CategoryResponse>>(replay = 0)
    val categoriesFlow = _categoriesFlow.asSharedFlow()

    private val _insertFlow = MutableSharedFlow<Boolean>()
    val insertFlow = _insertFlow.asSharedFlow()

    private val _foodFlow = MutableSharedFlow<FoodModel?>()
    val foodFlow = _foodFlow.asSharedFlow()

    private val _updateFlow = MutableSharedFlow<Boolean>()
    val updateFlow = _updateFlow.asSharedFlow()

    private val _deleteFlow = MutableSharedFlow<Boolean>()
    val deleteFlow = _deleteFlow.asSharedFlow()

    private val _addOrderItemFlow = MutableSharedFlow<Boolean>()
    val addOrderItemFlow = _addOrderItemFlow.asSharedFlow()

    // ✅ Flow xoá 1 món khỏi order
    private val _deleteOrderItemFlow = MutableSharedFlow<Boolean>()
    val deleteOrderItemFlow = _deleteOrderItemFlow.asSharedFlow()

    var imageUri: Uri? = null
        private set

    fun setImageUri(uri: Uri) {
        imageUri = uri
        viewModelScope.launch { _imageUriFlow.emit(imageUri) }
    }

    fun createMenuItem(context: Context, token: String, request: MenuItemRequest) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = catalogRepository.createMenuItem(context, token, request)
                if (response.isSuccess) _insertFlow.emit(true)
                else _errorFlow.emit(response.message ?: "Tạo món thất bại")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    fun updateMenuItem(context: Context, token: String, request: MenuItemRequest) {
        viewModelScope.launch {
            if (editFood == null) { _errorFlow.emit("Không tìm thấy món ăn"); return@launch }
            _loadingFlow.emit(true)
            try {
                val response = catalogRepository.updateMenuItem(context, token, editFood!!.id, request)
                if (response.isSuccess) _updateFlow.emit(true)
                else _errorFlow.emit(response.message ?: "Cập nhật thất bại")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    /** Lấy tất cả món ăn từ catalog-service, emit sang foodsFlow (FoodModel) */
    fun getFoodsFromServer(context: Context, token: String, categoryId: String? = null) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val response = catalogRepository.getMenuItems(context, token, categoryId)
                if (response.isSuccess) {
                    val models = (response.data ?: emptyList()).map { it.toFoodModel() }
                    _foodsFlow.emit(models)
                } else _errorFlow.emit(response.message ?: "Tải món ăn thất bại")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    /** Lấy danh sách danh mục */
    fun getCategories(context: Context, token: String) {
        viewModelScope.launch {
            try {
                val response = catalogRepository.getCategories(context, token)
                if (response.isSuccess) _categoriesFlow.emit(response.data ?: emptyList())
            } catch (_: Exception) { }
        }
    }

    private fun prepareFilePart(context: Context, uri: Uri): MultipartBody.Part? {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri)
        return try {
            val inputStream: InputStream? = contentResolver.openInputStream(uri)
            val inputData: ByteArray? = inputStream?.let { getBytes(it) }
            val requestBody: RequestBody? = if (mimeType != null && inputData != null) {
                inputData.toRequestBody(mimeType.toMediaTypeOrNull(), 0, inputData.size)
            } else null
            val fileName = getFileName(context, uri)
            if (requestBody != null) MultipartBody.Part.createFormData("file", fileName, requestBody) else null
        } catch (_: IOException) { null }
    }

    @Throws(IOException::class)
    private fun getBytes(inputStream: InputStream): ByteArray {
        val byteBuffer = ByteArrayOutputStream()
        val buffer = ByteArray(1024)
        var len: Int
        while ((inputStream.read(buffer).also { len = it }) != -1) {
            byteBuffer.write(buffer, 0, len)
        }
        return byteBuffer.toByteArray()
    }

    @SuppressLint("Range")
    private fun getFileName(context: Context, uri: Uri): String? {
        var result: String? = null
        if ("content" == uri.scheme) {
            context.contentResolver.query(uri, null, null, null, null).use { cursor ->
                if (cursor != null && cursor.moveToFirst()) {
                    result = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME))
                }
            }
        }
        if (result == null) result = uri.lastPathSegment
        return result
    }

    var editFood: FoodModel? = null
        private set

    @Suppress("DEPRECATION")
    fun setArgument(bundle: Bundle?) {
        viewModelScope.launch {
            bundle?.let {
                if (it.containsKey("edit_food")) {
                    editFood = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        it.getSerializable("edit_food", FoodModel::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        it.getSerializable("edit_food") as FoodModel
                    }
                    _foodFlow.emit(editFood!!)
                }
            }
        }
    }

    fun deleteMenuItem(context: Context, token: String) {
        viewModelScope.launch {
            if (editFood == null) { _errorFlow.emit("Không tìm thấy món ăn"); return@launch }
            _loadingFlow.emit(true)
            try {
                val response = catalogRepository.deleteMenuItem(context, token, editFood!!.id)
                _deleteFlow.emit(response.isSuccess)
                if (!response.isSuccess) _errorFlow.emit(response.message ?: "Xóa thất bại")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally { _loadingFlow.emit(false) }
        }
    }

    var activeOrderId: String? = null

    fun addOrderItem(context: Context, token: String, orderId: String, tableId: String, food: FoodModel, quantity: Int, note: String) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            // true kể từ lúc trừ kho thành công cho tới khi thêm món vào đơn thực sự thành công —
            // nếu vẫn còn true ở finally nghĩa là có bước sau đó thất bại/lỗi giữa chừng, cần hoàn kho
            // lại phần vừa trừ để tránh lệch số liệu kho (kho báo thiếu trong khi đơn chưa thực sự có món).
            var deductedPendingCompensation = false
            try {
                // ✅ Trừ kho NGAY khi thêm món vào đơn, validate đủ nguyên liệu cho ĐỦ số lượng yêu cầu
                // (không phải lúc bếp bắt đầu nấu hay lúc thanh toán) — nếu kho không đủ, BE trả lỗi
                // 400 kèm message chi tiết (VD: gọi 5 suất nhưng kho chỉ đủ 3) và chặn luôn việc thêm món.
                val deductRes = catalogRepository.deductStock(
                    context, token,
                    DeductStockRequest(items = listOf(DeductStockItem(menuItemId = food.id, quantity = quantity)))
                )
                if (!deductRes.isSuccess) {
                    _errorFlow.emit(deductRes.message ?: "Không đủ nguyên liệu trong kho để thêm món này")
                    return@launch
                }
                deductedPendingCompensation = true

                var currentOrderId = activeOrderId ?: orderId
                if (currentOrderId.isEmpty() && tableId.isNotEmpty()) {
                    val createRes = orderRepository.createOrder(
                        token,
                        com.food.order.data.request.OrderRequest(tableId = tableId, items = emptyList())
                    )
                    if (createRes.isSuccess && createRes.data?.id != null) {
                        currentOrderId = createRes.data.id
                        activeOrderId = currentOrderId
                    } else {
                        _errorFlow.emit(createRes.message ?: "Tạo đơn hàng thất bại")
                        return@launch
                    }
                }

                if (currentOrderId.isEmpty()) {
                    _errorFlow.emit("Không thể xác định đơn hàng")
                    return@launch
                }

                val response = orderRepository.addOrderItem(
                    token, currentOrderId,
                    AddOrderItemRequest(
                        foodId = food.id,
                        foodImage = food.image,
                        foodName = food.foodName,
                        unit = food.unit,
                        price = food.price,
                        quantity = quantity,
                        note = note
                    )
                )
                if (response.isSuccess) {
                    deductedPendingCompensation = false
                    _addOrderItemFlow.emit(true)
                } else {
                    _errorFlow.emit(response.message ?: "Add failed")
                }
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
            } finally {
                if (deductedPendingCompensation) {
                    refundDeductedStock(context, token, food.id, quantity)
                }
                _loadingFlow.emit(false)
            }
        }
    }

    /**
     * Hoàn kho best-effort khi đã trừ kho thành công nhưng bước tiếp theo (tạo đơn / thêm món vào
     * đơn) thất bại hoặc lỗi giữa chừng — tránh để kho bị "trừ khống" cho món chưa thực sự vào đơn.
     * Không throw ra ngoài: nếu hoàn kho cũng lỗi thì chấp nhận lệch kho tạm thời, không chặn luồng chính.
     */
    private suspend fun refundDeductedStock(context: Context, token: String, menuItemId: String, quantity: Int) {
        try {
            catalogRepository.refundStock(
                context, token,
                DeductStockRequest(items = listOf(DeductStockItem(menuItemId = menuItemId, quantity = quantity)))
            )
        } catch (_: Exception) {
            // best-effort — xem docstring ở trên
        }
    }

    // ✅ Xoá 1 món trong order theo foodId (đúng với API removeItemFromOrder)
    fun deleteOrderItemByFoodId(token: String, orderId: String, foodId: String) {
        viewModelScope.launch {
            _loadingFlow.emit(true)
            try {
                val resp = orderRepository.removeItemFromOrder(token, orderId, foodId)
                _deleteOrderItemFlow.emit(resp.isSuccess)
                if (!resp.isSuccess) _errorFlow.emit(resp.message ?: "Remove failed")
            } catch (e: Exception) {
                _errorFlow.emit(ApiError.parse(e))
                _deleteOrderItemFlow.emit(false)
            } finally {
                _loadingFlow.emit(false)
            }
        }
    }
}
