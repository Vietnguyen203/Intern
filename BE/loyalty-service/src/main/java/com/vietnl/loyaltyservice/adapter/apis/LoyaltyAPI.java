package com.vietnl.loyaltyservice.adapter.apis;

import com.vietnl.loyaltyservice.adapter.exception.ApiException;
import com.vietnl.loyaltyservice.application.responses.ApiResponse;
import com.vietnl.loyaltyservice.application.responses.RewardItemResponse;
import com.vietnl.loyaltyservice.application.responses.TierResponse;
import com.vietnl.loyaltyservice.application.usecases.LoyaltyService;
import com.vietnl.loyaltyservice.infrastructure.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class LoyaltyAPI {

    private final LoyaltyService loyaltyService;

    @GetMapping("/tiers")
    public ResponseEntity<ApiResponse<List<TierResponse>>> getTiers() {
        return ResponseEntity.ok(ApiResponse.success(loyaltyService.getTiers()));
    }

    @GetMapping("/rewards")
    public ResponseEntity<ApiResponse<List<RewardItemResponse>>> getRewards() {
        return ResponseEntity.ok(ApiResponse.success(loyaltyService.getActiveRewards()));
    }

    @PostMapping("/rewards/{id}/redeem")
    public ResponseEntity<ApiResponse<Map<String, String>>> redeem(@PathVariable UUID id, HttpServletRequest request) {
        Object customerIdAttr = request.getAttribute(JwtAuthenticationFilter.CUSTOMER_ID_ATTR);
        if (customerIdAttr == null) throw ApiException.unauthorized("Vui lòng đăng nhập.");
        String voucherCode = loyaltyService.redeemReward((UUID) customerIdAttr, id);
        return ResponseEntity.ok(ApiResponse.success("Đổi thưởng thành công", Map.of("voucherCode", voucherCode)));
    }
}
