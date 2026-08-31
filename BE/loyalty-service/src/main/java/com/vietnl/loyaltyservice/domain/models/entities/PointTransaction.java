package com.vietnl.loyaltyservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "point_transactions",
        // Ràng buộc UNIQUE (order_id, type) ở tầng DB — lớp bảo vệ cuối cùng chống cộng điểm trùng
        // khi Kafka redeliver/rebalance cùng 1 orderId (check existsByOrderIdAndType() ở service chỉ
        // là optimistic, có thể race). type=EARN là loại duy nhất gán orderId thực sự (REDEEM/ADJUST/EXPIRE
        // để orderId=null), nên 1 order chỉ tạo ra tối đa 1 dòng EARN. Nhiều dòng cùng orderId=NULL
        // (REDEEM/ADJUST/EXPIRE) vẫn hợp lệ vì NULL không tham gia so sánh UNIQUE.
        uniqueConstraints = @UniqueConstraint(name = "uk_point_tx_order_type", columnNames = {"order_id", "type"})
)
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
