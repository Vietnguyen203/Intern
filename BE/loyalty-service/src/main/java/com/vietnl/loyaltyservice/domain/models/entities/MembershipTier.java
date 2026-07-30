package com.vietnl.loyaltyservice.domain.models.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "membership_tiers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipTier {

    // Lưu dạng VARCHAR2(36) chuỗi UUID chuẩn trong DB, không dùng RAW(16).
    @Id
    @Column(name = "id", length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;

    /** BRONZE / SILVER / GOLD / DIAMOND — xem seed data trong migration.
     * Đặt tên "rank" thay vì "code" để tránh nhầm lẫn với các cột "code" khác (vd voucher code). */
    @Column(name = "tier_rank", nullable = false, unique = true, length = 50)
    private String rank;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "min_total_spent", nullable = false, precision = 15, scale = 2)
    private BigDecimal minTotalSpent;

    @Column(name = "discount_percent", precision = 5, scale = 2)
    private BigDecimal discountPercent;

    @Column(name = "point_multiplier", precision = 5, scale = 2)
    private BigDecimal pointMultiplier;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.id == null) this.id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
