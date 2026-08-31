package com.vietnl.tableservice.domain.entities;

import com.vietnl.tableservice.domain.enums.ReservationStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

// Đặt bàn trước theo ngày/giờ thật của khách (không có tài khoản, không cần đăng nhập).
// Cố tình KHÔNG đụng vào RestaurantTable.status — status phản ánh tình trạng bàn NGAY LÚC NÀY
// (và bị TableService.resetTablesStatus() reset về AVAILABLE mỗi khi service khởi động lại),
// còn đặt bàn trước là một lịch hẹn trong tương lai, cần tồn tại độc lập với vòng đời đó.
@Entity
@Table(name = "TABLE_RESERVATION")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableReservation {

    @Id
    @Column(name = "ID", length = 36)
    private UUID id;

    @Column(name = "TABLE_ID", length = 36)
    private UUID tableId;

    @Column(name = "TABLE_NUMBER")
    private Integer tableNumber;

    @Column(name = "CUSTOMER_NAME")
    private String customerName;

    @Column(name = "CUSTOMER_PHONE")
    private String customerPhone;

    @Column(name = "PARTY_SIZE")
    private Integer partySize;

    @Column(name = "RESERVED_AT")
    private LocalDateTime reservedAt;

    @Column(name = "DURATION_MINUTES")
    private Integer durationMinutes;

    @Column(name = "STATUS")
    private ReservationStatus status;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;

    // Không lưu DB — chỉ gắn kèm vào response NGAY lúc tạo lượt đặt "ngay bây giờ" để FE dùng làm
    // tableToken khi gọi POST /orders/public cho bàn này, khỏi phải gọi thêm GET /tables/{id}/qr-token.
    @Transient
    private String qrToken;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (id == null)
            id = UUID.randomUUID();
        if (durationMinutes == null)
            durationMinutes = 90;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
