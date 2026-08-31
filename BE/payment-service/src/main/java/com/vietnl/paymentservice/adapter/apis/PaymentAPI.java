package com.vietnl.paymentservice.adapter.apis;

import com.vietnl.paymentservice.application.dto.request.CreatePaymentRequest;
import com.vietnl.paymentservice.application.usecases.PaymentService;
import com.vietnl.paymentservice.domain.models.entities.Payment;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentAPI {

    private final PaymentService paymentService;

    @PostMapping
    public ResponseEntity<Payment> createPayment(@Valid @RequestBody CreatePaymentRequest request) {
        return ResponseEntity.ok(paymentService.createPayment(request));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<Payment> getByOrderId(@PathVariable UUID orderId) {
        Payment payment = paymentService.getPaymentByOrderId(orderId);
        if (payment == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(payment);
    }

    @PatchMapping("/order/{orderId}/complete")
    public ResponseEntity<Payment> complete(@PathVariable UUID orderId, @RequestParam(required = false) String transactionCode) {
        return ResponseEntity.ok(paymentService.completePayment(orderId, transactionCode));
    }

    // Dùng cho compensation phía FE: khi 1 đơn khác trong cùng lượt checkout của bàn cập nhật
    // COMPLETED thất bại, payment vừa tạo (PENDING) cho lượt đó cần được đánh dấu FAILED.
    @PatchMapping("/order/{orderId}/fail")
    public ResponseEntity<Payment> fail(@PathVariable UUID orderId) {
        return ResponseEntity.ok(paymentService.failPayment(orderId));
    }
}
