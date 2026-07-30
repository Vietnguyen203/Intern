package com.vietnl.loyaltyservice.application.usecases;

import com.vietnl.loyaltyservice.adapter.exception.ApiException;
import com.vietnl.loyaltyservice.application.requests.LoginRequest;
import com.vietnl.loyaltyservice.application.requests.RegisterRequest;
import com.vietnl.loyaltyservice.application.responses.AuthResponse;
import com.vietnl.loyaltyservice.application.responses.CustomerResponse;
import com.vietnl.loyaltyservice.domain.models.LoyaltyCodes;
import com.vietnl.loyaltyservice.domain.models.entities.Customer;
import com.vietnl.loyaltyservice.domain.models.entities.LoyaltyAccount;
import com.vietnl.loyaltyservice.domain.models.entities.MembershipTier;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.CustomerRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.LoyaltyAccountRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.MembershipTierRepository;
import com.vietnl.loyaltyservice.infrastructure.security.CustomerTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final LoyaltyAccountRepository loyaltyAccountRepository;
    private final MembershipTierRepository membershipTierRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomerTokenProvider customerTokenProvider;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (customerRepository.existsByPhone(req.getPhone())) {
            throw ApiException.conflict("Số điện thoại này đã có tài khoản.");
        }

        Customer customer = Customer.builder()
                .phone(req.getPhone())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getFullName())
                .email(req.getEmail())
                .status(LoyaltyCodes.CUSTOMER_ACTIVE)
                .build();
        if (req.getBirthday() != null && !req.getBirthday().isBlank()) {
            try {
                customer.setBirthday(LocalDateTime.parse(req.getBirthday() + "T00:00:00",
                        DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            } catch (Exception ignored) {
                // ngày sinh sai định dạng -> bỏ qua, không chặn đăng ký
            }
        }
        customer = customerRepository.save(customer);

        // Mỗi customer luôn có đúng 1 loyalty_account — tạo kèm ngay lúc đăng ký (0 điểm, hạng thấp nhất).
        MembershipTier defaultTier = membershipTierRepository.findAllByOrderBySortOrderAsc()
                .stream().findFirst().orElse(null);
        LoyaltyAccount account = LoyaltyAccount.builder()
                .customerId(customer.getId())
                .currentPoints(0)
                .totalSpent(BigDecimal.ZERO)
                .currentTierId(defaultTier != null ? defaultTier.getId() : null)
                .build();
        loyaltyAccountRepository.save(account);

        String token = customerTokenProvider.generateToken(customer.getId(), customer.getPhone());
        return AuthResponse.builder()
                .token(token)
                .customer(toResponse(customer, account, defaultTier))
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        Customer customer = customerRepository.findByPhone(req.getPhone())
                .orElseThrow(() -> ApiException.unauthorized("Số điện thoại hoặc mật khẩu không đúng."));

        if (!passwordEncoder.matches(req.getPassword(), customer.getPasswordHash())) {
            throw ApiException.unauthorized("Số điện thoại hoặc mật khẩu không đúng.");
        }
        if (customer.getStatus() != null && customer.getStatus() == LoyaltyCodes.CUSTOMER_LOCKED) {
            throw ApiException.unauthorized("Tài khoản đã bị khoá. Vui lòng liên hệ nhà hàng.");
        }

        LoyaltyAccount account = loyaltyAccountRepository.findByCustomerId(customer.getId()).orElse(null);
        MembershipTier tier = (account != null && account.getCurrentTierId() != null)
                ? membershipTierRepository.findById(account.getCurrentTierId()).orElse(null)
                : null;

        String token = customerTokenProvider.generateToken(customer.getId(), customer.getPhone());
        return AuthResponse.builder()
                .token(token)
                .customer(toResponse(customer, account, tier))
                .build();
    }

    @Transactional(readOnly = true)
    public CustomerResponse getMe(UUID customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
        LoyaltyAccount account = loyaltyAccountRepository.findByCustomerId(customerId).orElse(null);
        MembershipTier tier = (account != null && account.getCurrentTierId() != null)
                ? membershipTierRepository.findById(account.getCurrentTierId()).orElse(null)
                : null;
        return toResponse(customer, account, tier);
    }

    private CustomerResponse toResponse(Customer customer, LoyaltyAccount account, MembershipTier tier) {
        return CustomerResponse.builder()
                .id(customer.getId())
                .phone(customer.getPhone())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .currentPoints(account != null ? account.getCurrentPoints() : 0)
                .totalSpent(account != null ? account.getTotalSpent() : BigDecimal.ZERO)
                .tierRank(tier != null ? tier.getRank() : null)
                .tierName(tier != null ? tier.getName() : null)
                .build();
    }
}
