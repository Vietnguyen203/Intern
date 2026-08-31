package com.vietnl.tableservice.adapter.apis;

import com.vietnl.tableservice.application.dto.TableRequest;
import com.vietnl.tableservice.application.responses.ApiResponse;
import com.vietnl.tableservice.application.usecases.TableService;
import com.vietnl.tableservice.domain.entities.RestaurantTable;
import com.vietnl.tableservice.domain.enums.TableStatus;
import com.vietnl.tableservice.infrastructure.security.JwtUtil;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/tables")
@RequiredArgsConstructor
public class TableAPI {

    private final TableService tableService;
    private final JwtUtil jwtUtil;

    // QR in ra giấy dán tại bàn, không tiện đổi thường xuyên -> hạn dùng dài (1 năm).
    private static final long TABLE_QR_TOKEN_TTL_MS = 365L * 24 * 60 * 60 * 1000;

    // Nhân viên (đã đăng nhập) lấy token gắn với đúng bàn này để nhúng vào mã QR — order-service
    // dùng token này xác thực POST /orders/public thực sự đến từ bàn nào, thay vì chỉ tin tableId
    // trần trong body request (có thể bị sửa để đặt món "hộ" bàn khác).
    @GetMapping("/{id}/qr-token")
    public ResponseEntity<ApiResponse<Map<String, String>>> getQrToken(@PathVariable UUID id) {
        tableService.getById(id); // ném lỗi nếu bàn không tồn tại
        String token = jwtUtil.generateToken("table:" + id, "TABLE_QR", TABLE_QR_TOKEN_TTL_MS);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("token", token)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RestaurantTable>>> getAll(@RequestParam(required = false) TableStatus status) {
        List<RestaurantTable> tables = (status != null)
                ? tableService.getByStatus(status)
                : tableService.getAll();
        return ResponseEntity.ok(ApiResponse.ok(tables));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RestaurantTable>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(tableService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RestaurantTable>> create(@RequestBody TableRequest request) {
        RestaurantTable table = tableService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tạo bàn thành công", table));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RestaurantTable>> update(@PathVariable UUID id, @RequestBody TableRequest request) {
        RestaurantTable table = tableService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật thành công", table));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<RestaurantTable>> updateStatus(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        if (statusStr == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Thiếu trường 'status' trong body request"));
        }
        try {
            TableStatus status = TableStatus.valueOf(statusStr.toUpperCase());
            RestaurantTable table = tableService.updateStatus(id, status);
            return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái thành công", table));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Trạng thái '" + statusStr + "' không hợp lệ"));
        }
    }

    @PostMapping("/{id}/assign-order")
    public ResponseEntity<ApiResponse<RestaurantTable>> assignOrder(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String orderId = body.get("orderId");
        RestaurantTable table = tableService.assignOrder(id, orderId);
        return ResponseEntity.ok(ApiResponse.ok("Đã gán đơn hàng vào bàn", table));
    }

    @PostMapping("/{id}/release")
    public ResponseEntity<ApiResponse<RestaurantTable>> release(@PathVariable UUID id) {
        RestaurantTable table = tableService.updateStatus(id, TableStatus.CLEANING);
        return ResponseEntity.ok(ApiResponse.ok("Đã giải phóng bàn, chờ dọn dẹp", table));
    }

    @PostMapping("/{id}/ready")
    public ResponseEntity<ApiResponse<RestaurantTable>> ready(@PathVariable UUID id) {
        RestaurantTable table = tableService.updateStatus(id, TableStatus.AVAILABLE);
        return ResponseEntity.ok(ApiResponse.ok("Bàn đã sẵn sàng đón khách", table));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        tableService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Xóa bàn thành công", null));
    }
}