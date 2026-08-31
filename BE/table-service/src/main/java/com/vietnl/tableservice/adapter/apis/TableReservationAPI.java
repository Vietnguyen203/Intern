package com.vietnl.tableservice.adapter.apis;

import com.vietnl.tableservice.application.dto.ReservationRequest;
import com.vietnl.tableservice.application.responses.ApiResponse;
import com.vietnl.tableservice.application.usecases.TableReservationService;
import com.vietnl.tableservice.domain.entities.RestaurantTable;
import com.vietnl.tableservice.domain.entities.TableReservation;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tables/reservations")
@RequiredArgsConstructor
public class TableReservationAPI {

    private final TableReservationService reservationService;

    // Công khai — khách quét QR không có tableId hoặc chọn "đặt bàn trước" đều gọi được, không cần đăng nhập
    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<RestaurantTable>>> getAvailable(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime reservedAt,
            @RequestParam Integer partySize) {
        List<RestaurantTable> tables = reservationService.getAvailableTables(reservedAt, partySize);
        return ResponseEntity.ok(ApiResponse.ok(tables));
    }

    // Công khai — khách tự đặt bàn, không cần tài khoản
    @PostMapping("/public")
    public ResponseEntity<ApiResponse<TableReservation>> createPublic(@RequestBody ReservationRequest request) {
        TableReservation reservation = reservationService.createReservation(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Đặt bàn thành công", reservation));
    }

    // Nhân viên xem danh sách đặt bàn — cần đăng nhập
    @GetMapping
    public ResponseEntity<ApiResponse<List<TableReservation>>> getReservations(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ResponseEntity.ok(ApiResponse.ok(reservationService.getReservations(from, to)));
    }

    // Nhân viên huỷ lượt đặt bàn — cần đăng nhập
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<TableReservation>> cancel(@PathVariable UUID id) {
        TableReservation reservation = reservationService.cancelReservation(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã huỷ lượt đặt bàn", reservation));
    }
}
