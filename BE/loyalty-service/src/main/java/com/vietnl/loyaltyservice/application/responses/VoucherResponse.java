package com.vietnl.loyaltyservice.application.responses;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherResponse {
    private String code;
    private String status; // "ISSUED" | "USED" | "EXPIRED"
    private String discountType; // "PERCENT" | "FIXED_AMOUNT"
    private BigDecimal discountValue;
}
