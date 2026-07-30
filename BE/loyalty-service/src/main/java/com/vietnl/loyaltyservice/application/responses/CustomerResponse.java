package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Field naming khớp với những gì CustomerOrderApp.jsx (frontend) đã dùng sẵn:
 * customer.id, customer.fullName, customer.phone, customer.currentPoints,
 * customer.totalSpent, customer.tierRank.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerResponse {
    private UUID id;
    private String phone;
    private String fullName;
    private String email;
    private Integer currentPoints;
    private BigDecimal totalSpent;
    private String tierRank; // BRONZE / SILVER / GOLD / DIAMOND
    private String tierName;
}
