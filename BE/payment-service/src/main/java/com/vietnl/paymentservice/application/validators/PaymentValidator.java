package com.vietnl.paymentservice.application.validators;

import com.vietnl.paymentservice.application.dto.request.CreatePaymentRequest;
import com.vietnl.paymentservice.domain.models.enums.ExceptionMessage;
import com.vietnl.paymentservice.infrastructure.persistence.repositories.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PaymentValidator {

    private final PaymentRepository paymentRepository;

    public void validateCreate(CreatePaymentRequest request) {
        // Lưu ý: kiểm tra "đơn hàng đã có payment chưa" đã chuyển sang PaymentService.createPayment(),
        // vì cần phân biệt 2 trường hợp: (1) đã có payment PENDING do client gọi lại sau khi mất kết nối
        // giữa chừng — coi là idempotent retry, trả về bản ghi cũ; (2) đã có payment COMPLETED — đây mới
        // thực sự là yêu cầu thanh toán trùng, phải chặn.

        // Kiểm tra số tiền
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException(ExceptionMessage.INVALID_AMOUNT.getMessage());
        }

        // Kiểm tra phương thức thanh toán
        if (request.getMethod() == null) {
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "method"));
        }
    }
}
