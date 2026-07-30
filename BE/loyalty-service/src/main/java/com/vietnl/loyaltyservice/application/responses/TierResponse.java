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
public class TierResponse {
    private UUID id;
    private String rank;
    private String name;
    private BigDecimal minTotalSpent;
    private BigDecimal discountPercent;
    private BigDecimal pointMultiplier;
    private String color;
    private Integer sortOrder;
}
