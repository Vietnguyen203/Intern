package com.vietnl.tableservice.application.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ReservationRequest {
    private UUID tableId;
    private String customerName;
    private String customerPhone;
    private Integer partySize;
    private LocalDateTime reservedAt;
}
