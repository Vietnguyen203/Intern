package com.vietnl.loyaltyservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "voucher_redemptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoucherRedemption {

    // Tất cả cột UUID trong bảng này lưu dạng VARCHAR2(36) chuỗi UUID chuẩn trong DB, không RAW(16).
    @Id
    @Column(name = "id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(name = "customer_id", nullable = false, length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID customerId;

    @Column(name = "reward_item_id", nullable = false, length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID rewardItemId;

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    /** 0=ISSUED, 1=USED, 2=EXPIRED — xem {@link com.vietnl.loyaltyservice.domain.models.LoyaltyCodes} */
    @Column(name = "status", nullable = false)
    private Short status;

    @Column(name = "issued_at")
    private LocalDateTime issuedAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /** Trỏ sang orders bên order-service — không FK cứng, cùng lý do với PointTransaction.orderId. */
    @Column(name = "used_on_order_id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID usedOnOrderId;

    @PrePersist
    public void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID();
        if (this.status == null) this.status = com.vietnl.loyaltyservice.domain.models.LoyaltyCodes.VOUCHER_ISSUED;
        if (this.issuedAt == null) this.issuedAt = LocalDateTime.now();
    }
}
