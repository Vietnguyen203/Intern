package com.vietnl.orderservice.adapter.apis;

import com.vietnl.orderservice.application.requests.CreateOrderRequest;
import com.vietnl.orderservice.application.requests.OrderItemRequest;
import com.vietnl.orderservice.application.requests.UpdateOrderItemRequest;
import com.vietnl.orderservice.application.responses.ApiResponse;
import com.vietnl.orderservice.application.responses.EmployeeOrderResponse;
import com.vietnl.orderservice.application.responses.OrderResponse;
import com.vietnl.orderservice.application.usecases.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderAPI {

    private final OrderService orderService;

    // GET /orders/tables/{tableId}/creator - Lấy người tạo đơn hàng hiện tại của bàn
    @GetMapping("/tables/{tableId}/creator")
    public ResponseEntity<ApiResponse<EmployeeOrderResponse>> getCreatorByTable(@PathVariable String tableId) {
        String creator = orderService.getCreatorByTable(tableId);
        return ResponseEntity.ok(ApiResponse.ok(new EmployeeOrderResponse(creator)));
    }

    // POST /orders - Tạo đơn hàng mới
    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            @RequestHeader("Authorization") String token,
            Authentication auth) {
        String username = auth != null ? auth.getName() : "unknown";
        OrderResponse response = orderService.createOrder(request, username, token);
        return ResponseEntity.ok(ApiResponse.ok("Tạo đơn hàng thành công", response));
    }

    // POST /orders/public - Khách hàng tạo đơn hàng qua mã QR
    @PostMapping("/public")
    public ResponseEntity<ApiResponse<OrderResponse>> createPublicOrder(
            @Valid @RequestBody CreateOrderRequest request) {
        OrderResponse response = orderService.createPublicOrder(request);
        return ResponseEntity.ok(ApiResponse.ok("Khách hàng tạo đơn hàng thành công", response));
    }

    // GET /orders - Lấy tất cả đơn hàng
    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getAllOrders(
            @RequestParam(required = false) String status) {
        List<OrderResponse> orders = (status != null && !status.isBlank())
                ? orderService.getOrdersByStatus(status)
                : orderService.getAllOrders();
        return ResponseEntity.ok(ApiResponse.ok(orders));
    }

    // GET /orders/{id} - Lấy đơn theo ID
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getOrderById(id)));
    }

    // GET /orders/public/{id} - Khách hàng (không JWT) kiểm tra đơn đang mở của mình còn hợp lệ không,
    // trước khi quyết định gọi thêm món vào đơn cũ hay tạo đơn mới. Bắt buộc đúng tableToken của bàn.
    @GetMapping("/public/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getPublicOrderById(
            @PathVariable UUID id,
            @RequestParam String tableToken) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getPublicOrderById(id, tableToken)));
    }

    // POST /orders/{id}/items - Thêm món vào đơn (nhân viên, cần JWT qua Spring Security)
    @PostMapping("/{id}/items")
    public ResponseEntity<ApiResponse<OrderResponse>> addItem(
            @PathVariable UUID id,
            @Valid @RequestBody OrderItemRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Thêm món thành công", orderService.addItemToOrder(id, request)));
    }

    // POST /orders/public/{id}/items - Khách hàng (không JWT) gọi thêm món vào đơn đang mở qua QR.
    // Bắt buộc đúng tableToken của bàn (giống hệt POST /orders/public).
    @PostMapping("/public/{id}/items")
    public ResponseEntity<ApiResponse<OrderResponse>> addItemPublic(
            @PathVariable UUID id,
            @Valid @RequestBody OrderItemRequest request,
            @RequestParam String tableToken) {
        return ResponseEntity.ok(ApiResponse.ok("Thêm món thành công", orderService.addItemToPublicOrder(id, request, tableToken)));
    }

    // PUT /orders/{id}/items/{itemId} - Cập nhật số lượng món
    @PutMapping("/{id}/items/{itemId}")
    public ResponseEntity<ApiResponse<OrderResponse>> updateItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateOrderItemRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật món thành công", orderService.updateOrderItem(id, itemId, request)));
    }

    // DELETE /orders/{id}/items/{itemId} - Xóa món khỏi đơn
    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<ApiResponse<OrderResponse>> removeItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestHeader(value = "Authorization", required = false) String token) {
        return ResponseEntity.ok(ApiResponse.ok("Xóa món thành công", orderService.removeItemFromOrder(id, itemId, token)));
    }

    // PATCH /orders/{id}/status - Cập nhật trạng thái đơn
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status,
            @RequestHeader("Authorization") String token) {
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái thành công", orderService.updateOrderStatus(id, status, token)));
    }

    // DELETE /orders/{id} - Hủy đơn hàng
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> cancelOrder(
            @PathVariable UUID id,
            @RequestHeader("Authorization") String token) {
        orderService.cancelOrder(id, token);
        return ResponseEntity.ok(ApiResponse.ok("Hủy đơn thành công", null));
    }

    // PATCH /orders/items/{itemId}/kitchen-status - Bếp cập nhật trạng thái chế biến
    @PatchMapping("/items/{itemId}/kitchen-status")
    public ResponseEntity<ApiResponse<Void>> updateKitchenStatus(
            @PathVariable UUID itemId,
            @RequestParam String status,
            @RequestHeader(value = "Authorization", required = false) String token) {
        orderService.updateKitchenStatus(itemId, status, token);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái bếp thành công", null));
    }
}
