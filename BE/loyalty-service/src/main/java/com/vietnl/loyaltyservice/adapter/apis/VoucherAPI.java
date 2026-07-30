package com.vietnl.loyaltyservice.adapter.apis;

import com.vietnl.loyaltyservice.application.responses.ApiResponse;
import com.vietnl.loyaltyservice.application.responses.VoucherResponse;
import com.vietnl.loyaltyservice.application.usecases.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Dùng bởi WAITER lúc checkout (App.jsx) — xem SecurityConfig/JwtAuthenticationFilter: path /vouchers/**
 * bắt buộc JWT NHÂN VIÊN, không phải JWT khách hàng. */
@RestController
@RequestMapping("/vouchers")
@RequiredArgsConstructor
public class VoucherAPI {

    private final VoucherService voucherService;

    @PostMapping("/{code}/validate")
    public ResponseEntity<ApiResponse<VoucherResponse>> validate(@PathVariable String code) {
        return ResponseEntity.ok(ApiResponse.success(voucherService.validate(code)));
    }

    @PostMapping("/{code}/use")
    public ResponseEntity<ApiResponse<VoucherResponse>> use(@PathVariable String code, @RequestBody(required = false) Map<String, String> body) {
        UUID orderId = null;
        if (body != null && body.get("orderId") != null && !body.get("orderId").isBlank()) {
            orderId = UUID.fromString(body.get("orderId"));
        }
        return ResponseEntity.ok(ApiResponse.success(voucherService.use(code, orderId)));
    }
}
