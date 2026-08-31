package com.vietnl.orderservice.application.requests;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateOrderRequest {

    private String tableId;
    private String tableNumber;
    private String note;

    // Khách hàng loyalty-service đã đăng nhập gửi kèm khi tự đặt món qua QR (FE đã gửi field này từ
    // trước — xem CustomerOrderApp.jsx); null với đơn của khách vãng lai hoặc nhân viên tạo hộ.
    private UUID customerId;

    // Token gắn với đúng bàn (tableId) — do table-service cấp khi in mã QR hoặc lúc đặt bàn "ngay".
    // Bắt buộc phải khớp với tableId khi gọi qua POST /orders/public (xem OrderService.createPublicOrder);
    // request tạo đơn của NHÂN VIÊN (POST /orders, có JWT) không cần field này.
    private String tableToken;

    @Valid
    private List<OrderItemRequest> items;
}
