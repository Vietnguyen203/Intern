package com.vietnl.loyaltyservice.adapter.apis;

import com.vietnl.loyaltyservice.application.responses.ApiResponse;
import com.vietnl.loyaltyservice.application.responses.CustomerResponse;
import com.vietnl.loyaltyservice.application.responses.PointTransactionResponse;
import com.vietnl.loyaltyservice.application.usecases.CustomerService;
import com.vietnl.loyaltyservice.application.usecases.LoyaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * API cho NHÂN VIÊN xem danh sách + chi tiết tài khoản khách hàng (màn "Tài khoản" > tab "Khách hàng"
 * trên web nhân viên) — CHỈ ĐỌC. Cố ý KHÔNG có endpoint sửa/xoá thông tin khách (tên/SĐT/email/điểm...)
 * ở đây, đúng yêu cầu "quản lý nhưng không thay đổi thông tin".
 *
 * Path /admin/** bắt buộc JWT NHÂN VIÊN, không phải JWT khách hàng — xem
 * JwtAuthenticationFilter (route theo path) + SecurityConfig (anyRequest().authenticated()).
 */
@RestController
@RequestMapping("/admin/customers")
@RequiredArgsConstructor
public class AdminAPI {

    private final CustomerService customerService;
    private final LoyaltyService loyaltyService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerResponse>>> listCustomers() {
        return ResponseEntity.ok(ApiResponse.success(customerService.listAllForAdmin()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CustomerResponse>> getCustomer(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getMe(id)));
    }

    @GetMapping("/{id}/points-history")
    public ResponseEntity<ApiResponse<List<PointTransactionResponse>>> getPointsHistory(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(loyaltyService.getPointsHistory(id)));
    }
}
