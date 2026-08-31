package com.vietnl.paymentservice.application.usecases;

import com.vietnl.paymentservice.application.dto.request.CreatePaymentRequest;
import com.vietnl.paymentservice.application.validators.PaymentValidator;
import com.vietnl.paymentservice.domain.models.entities.Payment;
import com.vietnl.paymentservice.domain.models.enums.PaymentStatus;
import com.vietnl.paymentservice.domain.models.enums.ExceptionMessage;
import com.vietnl.paymentservice.infrastructure.persistence.repositories.PaymentRepository;
import com.vietnl.paymentservice.infrastructure.communication.NotificationFeignClient;
import com.vietnl.paymentservice.infrastructure.communication.OrderFeignClient;
import com.vietnl.paymentservice.infrastructure.messaging.PaymentCompletedEvent;
import com.vietnl.paymentservice.infrastructure.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentValidator paymentValidator;
    private final NotificationFeignClient notificationFeignClient;
    private final OrderFeignClient orderFeignClient;
    private final JwtUtil jwtUtil;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${payment.kafka.completed-topic:payment-completed}")
    private String paymentCompletedTopic;

    @Transactional
    public Payment createPayment(CreatePaymentRequest request) {
        // Idempotency: nếu order này đã có payment và còn PENDING, nghĩa là lần gọi trước đã lưu thành
        // công nhưng client (vd. mất mạng giữa lúc checkout) không nhận được phản hồi rồi gọi lại — trả
        // về bản ghi cũ thay vì báo lỗi trùng, để nút "Xác nhận thanh toán" có thể bấm lại an toàn.
        // Nếu payment đã COMPLETED thì đây mới thực sự là một yêu cầu thanh toán trùng, phải chặn.
        Payment existing = paymentRepository.findByOrderId(request.getOrderId()).orElse(null);
        if (existing != null) {
            if (existing.getStatus() == PaymentStatus.PENDING) {
                return existing;
            }
            throw new RuntimeException(ExceptionMessage.DUPLICATE_PAYMENT.getMessage());
        }

        paymentValidator.validateCreate(request);

        Payment payment = new Payment();
        payment.setOrderId(request.getOrderId());
        payment.setAmount(request.getAmount());
        payment.setMethod(request.getMethod());
        payment.setStatus(PaymentStatus.PENDING);
        return paymentRepository.save(payment);
    }

    public Payment getPaymentByOrderId(UUID orderId) {
        return paymentRepository.findByOrderId(orderId).orElse(null);
    }

    @Transactional
    public Payment completePayment(UUID orderId, String transactionCode) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new RuntimeException("Payment not found for order: " + orderId));

        // Đối chiếu số tiền thanh toán với tổng tiền THỰC TẾ của đơn hàng bên order-service trước khi
        // đánh dấu COMPLETED. Trước đây completePayment() chỉ đổi trạng thái theo payment.amount đã lưu
        // sẵn từ lúc createPayment() (do FE gửi lên) mà không đối chiếu lại — nếu amount đó sai (bug FE,
        // đơn bị sửa thêm/bớt món sau khi tạo payment PENDING, hoặc bị gọi thẳng API với số tiền tuỳ ý)
        // thì payment vẫn được xác nhận COMPLETED bình thường, gây lệch doanh thu và có thể bị lợi dụng
        // để "thanh toán thiếu". Payment entity không lưu sẵn tổng tiền đơn hàng nên phải gọi Feign sang
        // order-service để lấy totalAmount thật; dùng internal service token (không phải token nhân
        // viên) vì complete() không nhận Authorization header từ request.
        java.math.BigDecimal orderTotal = fetchOrderTotalAmount(orderId);
        if (orderTotal == null) {
            throw new RuntimeException(ExceptionMessage.ORDER_NOT_FOUND.getMessage());
        }
        if (orderTotal.compareTo(payment.getAmount()) != 0) {
            log.warn("Số tiền thanh toán không khớp: orderId={}, payment.amount={}, order.totalAmount={}",
                    orderId, payment.getAmount(), orderTotal);
            throw new RuntimeException(ExceptionMessage.AMOUNT_MISMATCH.getMessage());
        }

        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setTransactionCode(transactionCode);
        payment.setPaidAt(LocalDateTime.now());

        Payment saved = paymentRepository.save(payment);

        // Thông báo cho Admin/Cashier/Waiter về việc thanh toán thành công
        sendNotification(
                "Thanh toán thành công",
                "Đơn hàng " + orderId.toString().substring(0, 8) + " đã thanh toán: "
                        + String.format("%,.0f", saved.getAmount().doubleValue()) + " VNĐ",
                "success",
                "ALL");

        // Phát PaymentCompletedEvent cho loyalty-service (qua Kafka) để cộng điểm cho khách, nếu đơn
        // này có gắn customerId (khách đã đăng nhập loyalty lúc đặt món qua QR — xem CustomerOrderApp.jsx
        // + CreateOrderRequest.customerId). Chạy bất đồng bộ + nuốt lỗi giống sendNotification(): việc
        // publish thất bại (order-service down, Kafka down, ...) không được làm hỏng luồng thanh toán
        // chính, vì payment đã COMPLETED thật sự rồi.
        publishPaymentCompletedEvent(orderId, saved.getAmount());

        return saved;
    }

    // Gọi order-service (GET /orders/{id}) bằng internal service token để lấy tổng tiền thật của đơn
    // hàng — dùng cho việc đối chiếu ở completePayment(). Trả về null nếu không lấy được (order-service
    // lỗi/không phản hồi, hoặc response không có totalAmount) để completePayment() từ chối thay vì
    // hoàn tất một cách "im lặng" khi không thể xác minh số tiền.
    private java.math.BigDecimal fetchOrderTotalAmount(UUID orderId) {
        try {
            Map<String, Object> body = orderFeignClient.getOrderById(
                    orderId, "Bearer " + jwtUtil.generateInternalServiceToken());
            Object dataObj = body != null ? body.get("data") : null;
            if (dataObj instanceof Map) {
                Object totalObj = ((Map<?, ?>) dataObj).get("totalAmount");
                if (totalObj != null) {
                    return new java.math.BigDecimal(totalObj.toString());
                }
            }
        } catch (Exception e) {
            log.error("Không lấy được tổng tiền đơn hàng orderId={} để đối chiếu thanh toán: {}", orderId, e.getMessage(), e);
        }
        return null;
    }

    private void publishPaymentCompletedEvent(UUID orderId, java.math.BigDecimal amount) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> body = orderFeignClient.getOrderById(
                        orderId, "Bearer " + jwtUtil.generateInternalServiceToken());
                Object dataObj = body != null ? body.get("data") : null;
                UUID customerId = null;
                if (dataObj instanceof Map) {
                    Object rawCustomerId = ((Map<?, ?>) dataObj).get("customerId");
                    if (rawCustomerId != null) {
                        customerId = UUID.fromString(rawCustomerId.toString());
                    }
                }
                // Vẫn publish kể cả khi customerId == null (đơn của khách vãng lai/nhân viên tạo) —
                // loyalty-service tự bỏ qua, không cộng điểm, khi customerId rỗng (xem
                // LoyaltyService.earnPointsForPayment).
                kafkaTemplate.send(paymentCompletedTopic, orderId.toString(),
                        new PaymentCompletedEvent(customerId, orderId, amount));
            } catch (Exception ex) {
                log.error("Lỗi phát PaymentCompletedEvent cho orderId={}: {}", orderId, ex.getMessage(), ex);
            }
        });
    }

    // ===== ĐÁNH DẤU THANH TOÁN THẤT BẠI (dùng khi compensation: một đơn khác trong cùng lượt
    // checkout của bàn cập nhật COMPLETED thất bại, nên payment vừa tạo cần được coi là không xảy ra) =====
    @Transactional
    public Payment failPayment(UUID orderId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new RuntimeException("Payment not found for order: " + orderId));
        payment.setStatus(PaymentStatus.FAILED);
        return paymentRepository.save(payment);
    }

    private void sendNotification(String title, String message, String type, String role) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                NotificationFeignClient.NotificationRequest payload = new NotificationFeignClient.NotificationRequest(title, message, type, role);
                notificationFeignClient.sendNotification(payload);
            } catch (Exception e) {
            }
        });
    }
}
