package com.vietnl.loyaltyservice.infrastructure.messaging;

import com.vietnl.loyaltyservice.application.usecases.LoyaltyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentEventListener {

    private final LoyaltyService loyaltyService;

    // Tên topic CHƯA XÁC NHẬN với payment-service thật — sửa lại giá trị mặc định trong
    // application.yml (loyalty.kafka.payment-topic) khi biết chính xác tên topic đang dùng.
    @KafkaListener(
            topics = "${loyalty.kafka.payment-topic}",
            containerFactory = "paymentEventListenerContainerFactory"
    )
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        log.info("Nhận PaymentCompletedEvent: customerId={}, orderId={}, amount={}",
                event.getCustomerId(), event.getOrderId(), event.getAmount());
        try {
            loyaltyService.earnPointsForPayment(event.getCustomerId(), event.getOrderId(), event.getAmount());
        } catch (Exception ex) {

            log.error("Lỗi xử lý PaymentCompletedEvent cho orderId={}: {}", event.getOrderId(), ex.getMessage(), ex);
        }
    }
}
