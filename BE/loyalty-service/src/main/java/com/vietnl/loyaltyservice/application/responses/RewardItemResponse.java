package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RewardItemResponse {
    private UUID id;
    private String name;
    private String description;
    private Integer pointsCost;
    private String discountType; // "PERCENT" | "FIXED_AMOUNT"
    private BigDecimal discountValue;
}
