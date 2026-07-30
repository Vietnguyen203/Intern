package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PointTransactionResponse {
    private UUID id;
    private String type; // "EARN" | "REDEEM" | "EXPIRE" | "ADJUST"
    private Integer points;
    private String note;
    private LocalDateTime createdAt;
}
