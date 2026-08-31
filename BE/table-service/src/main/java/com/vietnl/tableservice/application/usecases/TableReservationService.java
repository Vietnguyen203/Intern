package com.vietnl.tableservice.application.usecases;

import com.vietnl.tableservice.application.dto.ReservationRequest;
import com.vietnl.tableservice.domain.entities.RestaurantTable;
import com.vietnl.tableservice.domain.entities.TableReservation;
import com.vietnl.tableservice.domain.enums.ReservationStatus;
import com.vietnl.tableservice.domain.enums.TableStatus;
import com.vietnl.tableservice.infrastructure.persistence.TableRepository;
import com.vietnl.tableservice.infrastructure.persistence.TableReservationRepository;
import com.vietnl.tableservice.infrastructure.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TableReservationService {

    private static final int DEFAULT_DURATION_MINUTES = 90;
    private static final int IMMEDIATE_WINDOW_MINUTES = 15;

    private final TableReservationRepository reservationRepository;
    private final TableRepository tableRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final JwtUtil jwtUtil;

    private static final long TABLE_QR_TOKEN_TTL_MS = 365L * 24 * 60 * 60 * 1000;

    private void notifyTableChange() {
        messagingTemplate.convertAndSend("/topic/tables", "REFRESH_TABLES");
    }

    // Hai khoảng [aStart, aEnd) và [bStart, bEnd) có chồng lấn hay không
    private boolean overlaps(LocalDateTime aStart, LocalDateTime aEnd, LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    private boolean isReservedAt(RestaurantTable table, LocalDateTime at, int durationMinutes) {
        LocalDateTime end = at.plusMinutes(durationMinutes);
        List<TableReservation> confirmed = reservationRepository.findByTableIdAndStatus(table.getId(), ReservationStatus.CONFIRMED);
        return confirmed.stream().anyMatch(r -> {
            LocalDateTime rStart = r.getReservedAt();
            LocalDateTime rEnd = rStart.plusMinutes(r.getDurationMinutes() != null ? r.getDurationMinutes() : DEFAULT_DURATION_MINUTES);
            return overlaps(at, end, rStart, rEnd);
        });
    }

    public List<RestaurantTable> getAvailableTables(LocalDateTime at, int partySize) {
        boolean isImmediate = Math.abs(Duration.between(LocalDateTime.now(), at).toMinutes()) <= IMMEDIATE_WINDOW_MINUTES;

        return tableRepository.findAll().stream()
                .filter(t -> t.getCapacity() != null && t.getCapacity() >= partySize)
                .filter(t -> !isImmediate || t.getStatus() == TableStatus.AVAILABLE)
                .filter(t -> !isReservedAt(t, at, DEFAULT_DURATION_MINUTES))
                .collect(Collectors.toList());
    }

    @Transactional
    public TableReservation createReservation(ReservationRequest request) {
        if (request.getTableId() == null) {
            throw new RuntimeException("Thiếu thông tin bàn muốn đặt");
        }
        if (request.getReservedAt() == null) {
            throw new RuntimeException("Thiếu thời gian đặt bàn");
        }
        if (request.getReservedAt().isBefore(LocalDateTime.now().minus(1, ChronoUnit.MINUTES))) {
            throw new RuntimeException("Thời gian đặt bàn không thể ở trong quá khứ");
        }
        if (request.getCustomerName() == null || request.getCustomerName().isBlank()) {
            throw new RuntimeException("Thiếu tên khách đặt bàn");
        }
        if (request.getPartySize() == null || request.getPartySize() <= 0) {
            throw new RuntimeException("Số lượng khách không hợp lệ");
        }

        // Khoá bản ghi bàn này (SELECT ... FOR UPDATE) trong suốt phần còn lại của transaction —
        // gồm cả bước kiểm tra còn trống (isReservedAt) lẫn bước tạo lượt đặt bên dưới. TRƯỚC ĐÂY dùng
        // findById (không khoá) nên 2 request đặt bàn gần như đồng thời cho cùng 1 bàn/khung giờ đều có
        // thể cùng đọc thấy "còn trống" trước khi cả hai cùng tạo reservation, gây double booking.
        RestaurantTable table = tableRepository.findByIdForUpdate(request.getTableId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bàn với ID: " + request.getTableId()));

        if (table.getCapacity() != null && request.getPartySize() > table.getCapacity()) {
            throw new RuntimeException("Bàn này chỉ chứa tối đa " + table.getCapacity() + " khách");
        }

        boolean isImmediate = Math.abs(Duration.between(LocalDateTime.now(), request.getReservedAt()).toMinutes()) <= IMMEDIATE_WINDOW_MINUTES;
        if (isImmediate && table.getStatus() != TableStatus.AVAILABLE) {
            throw new RuntimeException("Bàn hiện không trống");
        }
        if (isReservedAt(table, request.getReservedAt(), DEFAULT_DURATION_MINUTES)) {
            throw new RuntimeException("Bàn đã có người đặt trong khung giờ này");
        }

        TableReservation reservation = TableReservation.builder()
                .id(UUID.randomUUID())
                .tableId(table.getId())
                .tableNumber(table.getTableNumber())
                .customerName(request.getCustomerName())
                .customerPhone(request.getCustomerPhone())
                .partySize(request.getPartySize())
                .reservedAt(request.getReservedAt())
                .durationMinutes(DEFAULT_DURATION_MINUTES)
                .status(ReservationStatus.CONFIRMED)
                .build();

        TableReservation saved = reservationRepository.save(reservation);
        // Cấp kèm token gắn với đúng bàn này — nếu là lượt "đặt ngay" (isImmediate), khách vào thẳng
        // thực đơn nên cần token này để gọi POST /orders/public ngay, giống hệt như đã quét mã QR.
        saved.setQrToken(jwtUtil.generateToken("table:" + table.getId(), "TABLE_QR", TABLE_QR_TOKEN_TTL_MS));
        notifyTableChange();
        return saved;
    }

    public List<TableReservation> getReservations(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            return reservationRepository.findAll();
        }
        return reservationRepository.findByStatusAndReservedAtBetween(ReservationStatus.CONFIRMED, from, to);
    }

    public TableReservation cancelReservation(UUID id) {
        TableReservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lượt đặt bàn với ID: " + id));
        reservation.setStatus(ReservationStatus.CANCELLED);
        TableReservation saved = reservationRepository.save(reservation);
        notifyTableChange();
        return saved;
    }
}
