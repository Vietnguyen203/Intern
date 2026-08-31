package com.vietnl.paymentservice.infrastructure.messaging;

import java.math.BigDecimal;
import java.util.UUID;

// Payload publish sang Kafka topic "payment-completed" khi 1 payment chuyển sang COMPLETED.
// PHẢI khớp field-for-field với loyaltyservice.infrastructure.messaging.PaymentCompletedEvent bên
// loyalty-service (2 service độc lập, không dùng chung class — chỉ cần cùng field name/JSON shape).
public class PaymentCompletedEvent {

    private UUID customerId;
    private UUID orderId;
    private BigDecimal amount;

    public PaymentCompletedEvent() {}

    public PaymentCompletedEvent(UUID customerId, UUID orderId, BigDecimal amount) {
        this.customerId = customerId;
        this.orderId = orderId;
        this.amount = amount;
    }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
