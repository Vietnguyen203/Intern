package com.vietnl.loyaltyservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "point_transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointTransaction {

    // Tất cả cột UUID trong bảng này lưu dạng VARCHAR2(36) chuỗi UUID chuẩn trong DB, không RAW(16).
    @Id
    @Column(name = "id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(name = "customer_id", nullable = false, length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID customerId;

    /**
     * Trỏ sang bảng orders bên order-service — KHÔNG có FK cứng (khác service/domain),
     * chỉ liên kết lỏng qua UUID, giống order_items.menu_item_id trỏ sang catalog-service.
     */
    @Column(name = "order_id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID orderId;

    /** 0=EARN, 1=REDEEM, 2=EXPIRE, 3=ADJUST — xem {@link com.vietnl.loyaltyservice.domain.models.LoyaltyCodes} */
    @Column(name = "type", nullable = false)
    private Short type;

    /** Dương với EARN/ADJUST(+), âm với REDEEM/EXPIRE. */
    @Column(name = "points", nullable = false)
    private Integer points;

    @Column(name = "note")
    private String note;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID();
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
    }
}
