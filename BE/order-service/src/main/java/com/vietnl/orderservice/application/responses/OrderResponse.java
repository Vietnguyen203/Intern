package com.vietnl.orderservice.application.responses;

import com.vietnl.orderservice.domain.models.entities.Order;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
public class OrderResponse {

    private UUID id;
    private String tableId;
    private String tableNumber;
    private UUID customerId;
    private String createdBy;
    private String status;
    private String note;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<OrderItemResponse> items;

    public static OrderResponse from(Order order) {
        OrderResponse r = new OrderResponse();
        r.setId(order.getId());
        r.setTableId(order.getTableId());
        r.setTableNumber(order.getTableNumber());
        r.setCustomerId(order.getCustomerId());
        r.setCreatedBy(order.getCreatedBy());
        r.setStatus(order.getStatus());
        r.setNote(order.getNote());
        r.setTotalAmount(order.getTotalAmount());
        r.setCreatedAt(order.getCreatedAt());
        r.setUpdatedAt(order.getUpdatedAt());
        r.setItems(
            order.getItems().stream()
                .map(OrderItemResponse::from)
                .collect(Collectors.toList())
        );
        return r;
    }
}
