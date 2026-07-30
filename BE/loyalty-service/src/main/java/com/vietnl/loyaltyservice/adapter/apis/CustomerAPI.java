package com.vietnl.loyaltyservice.adapter.apis;

import com.vietnl.loyaltyservice.adapter.exception.ApiException;
import com.vietnl.loyaltyservice.application.requests.LoginRequest;
import com.vietnl.loyaltyservice.application.requests.RegisterRequest;
import com.vietnl.loyaltyservice.application.responses.ApiResponse;
import com.vietnl.loyaltyservice.application.responses.AuthResponse;
import com.vietnl.loyaltyservice.application.responses.CustomerResponse;
import com.vietnl.loyaltyservice.application.responses.PointTransactionResponse;
import com.vietnl.loyaltyservice.application.usecases.CustomerService;
import com.vietnl.loyaltyservice.application.usecases.LoyaltyService;
import com.vietnl.loyaltyservice.infrastructure.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerAPI {

    private final CustomerService customerService;
    private final LoyaltyService loyaltyService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Đăng ký thành công", customerService.register(req)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", customerService.login(req)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<CustomerResponse>> me(HttpServletRequest request) {
        UUID customerId = requireCustomerId(request);
        return ResponseEntity.ok(ApiResponse.success(customerService.getMe(customerId)));
    }

    @GetMapping("/me/points-history")
    public ResponseEntity<ApiResponse<List<PointTransactionResponse>>> pointsHistory(HttpServletRequest request) {
        UUID customerId = requireCustomerId(request);
        return ResponseEntity.ok(ApiResponse.success(loyaltyService.getPointsHistory(customerId)));
    }

    private UUID requireCustomerId(HttpServletRequest request) {
        Object id = request.getAttribute(JwtAuthenticationFilter.CUSTOMER_ID_ATTR);
        if (id == null) throw ApiException.unauthorized("Vui lòng đăng nhập.");
        return (UUID) id;
    }
}
