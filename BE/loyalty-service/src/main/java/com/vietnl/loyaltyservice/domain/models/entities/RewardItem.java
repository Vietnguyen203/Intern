package com.vietnl.loyaltyservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "reward_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardItem {

    // Lưu dạng VARCHAR2(36) chuỗi UUID chuẩn trong DB, không dùng RAW(16).
    @Id
    @Column(name = "id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "points_cost", nullable = false)
    private Integer pointsCost;

    /** 0=PERCENT, 1=FIXED_AMOUNT — xem {@link com.vietnl.loyaltyservice.domain.models.LoyaltyCodes} */
    @Column(name = "discount_type", nullable = false)
    private Short discountType;

    @Column(name = "discount_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountValue;

    /** 1 = đang bật, 0 = ẩn */
    @Column(name = "active", nullable = false)
    private Short active;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID();
        if (this.active == null) this.active = com.vietnl.loyaltyservice.domain.models.LoyaltyCodes.REWARD_ACTIVE;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
