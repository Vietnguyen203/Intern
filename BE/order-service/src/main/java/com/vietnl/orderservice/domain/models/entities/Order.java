package com.vietnl.orderservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "table_id")
    private String tableId;

    @Column(name = "table_number")
    private String tableNumber;

    // Khách hàng loyalty-service đã đăng nhập lúc đặt món qua QR (nullable — đơn của khách vãng lai
    // hoặc do nhân viên tạo thì để trống). Dùng để payment-service biết cộng điểm cho ai lúc thanh toán.
    @Column(name = "customer_id")
    private UUID customerId;

    // Nhân viên tạo đơn
    @Column(name = "created_by")
    private String createdBy;

    // Trạng thái: PENDING, CONFIRMED, COMPLETED, CANCELLED
    @Column(name = "status", nullable = false)
    private String status = "PENDING";

    @Column(name = "note", length = 500)
    private String note;

    // Tổng tiền (tính lại khi thêm/xóa món)
    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void recalculateTotal() {
        this.totalAmount = items.stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
