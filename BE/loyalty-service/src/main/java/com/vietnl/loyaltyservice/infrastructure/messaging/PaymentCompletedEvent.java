package com.vietnl.loyaltyservice.infrastructure.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentCompletedEvent {
    private UUID customerId;
    private UUID orderId;
    private BigDecimal amount;
}
