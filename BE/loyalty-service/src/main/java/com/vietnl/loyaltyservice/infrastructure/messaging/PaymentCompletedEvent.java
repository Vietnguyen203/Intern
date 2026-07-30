package com.vietnl.loyaltyservice.infrastructure.messaging;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO cho event Kafka mà payment-service phát ra khi xác nhận thanh toán thành công.
 *
 * CHƯA XÁC NHẬN được tên topic + tên field chính xác vì chưa đọc được source payment-service
 * (đang chờ Việt gửi zip). Tạm đặt tên field theo quy ước hợp lý nhất + @JsonIgnoreProperties
 * (ignoreUnknown) để không vỡ khi payload thật có thêm field khác tên. Khi có source thật,
 * chỉ cần sửa lại đúng 3 field customerId/orderId/amount (và tên topic trong application.yml
 * ở loyalty.kafka.payment-topic) là chạy được ngay, không phải sửa logic tính điểm.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentCompletedEvent {
    private UUID customerId;   // null nếu khách không đăng nhập lúc đặt món -> bỏ qua, không cộng điểm
    private UUID orderId;
    private BigDecimal amount;
}
