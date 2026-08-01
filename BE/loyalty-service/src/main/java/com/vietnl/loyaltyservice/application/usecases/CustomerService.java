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
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final LoyaltyAccountRepository loyaltyAccountRepository;
    private final MembershipTierRepository membershipTierRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomerTokenProvider customerTokenProvider;
    private final JavaMailSender mailSender;

    // Đăng ký 2 bước (xác nhận OTP qua email) — cùng kiểu in-memory storage như users-service đang
    // dùng cho OTP đăng nhập nhân viên, chỉ khác là giữ tạm RegisterRequest vì customer chưa tồn tại
    // trong DB để tra lại. Key = phone (định danh duy nhất của customer).
    private static final Map<String, RegisterRequest> pendingRegistrations = new ConcurrentHashMap<>();
    private static final Map<String, String> registerOtpStorage = new ConcurrentHashMap<>();
    private static final Map<String, LocalDateTime> registerOtpExpiryStorage = new ConcurrentHashMap<>();

    /** Đăng ký bước 1: validate + giữ tạm request, gửi OTP về email, CHƯA tạo Customer trong DB. */
    @Transactional(readOnly = true)
    public AuthResponse register(RegisterRequest req) {
        if (customerRepository.existsByPhone(req.getPhone())) {
            throw ApiException.conflict("Số điện thoại này đã có tài khoản.");
        }

        String otpCode = String.format("%06d", new Random().nextInt(999999));
        pendingRegistrations.put(req.getPhone(), req);
        registerOtpStorage.put(req.getPhone(), otpCode);
        registerOtpExpiryStorage.put(req.getPhone(), LocalDateTime.now().plusMinutes(5));

        sendOtpEmail(req.getEmail(), otpCode);

        return AuthResponse.builder()
                .status("REQUIRE_OTP")
                .build();
    }

    private void sendOtpEmail(String email, String otpCode) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("Mã OTP xác nhận đăng ký tài khoản");
            message.setText("Mã OTP xác nhận đăng ký của bạn là: " + otpCode + ". Mã này có hiệu lực trong 5 phút.");
            mailSender.send(message);
        } catch (Exception e) {
            // Không gửi được email OTP -> xử lý ngầm, giống cách users-service đang làm cho OTP đăng
            // nhập (không chặn luồng, nhưng verify-otp bước sau sẽ tự fail vì OTP không đúng/hết hạn).
        }
    }

    /** Đăng ký bước 2: xác nhận OTP rồi mới thực sự tạo Customer + LoyaltyAccount. */
    @Transactional
    public AuthResponse verifyRegisterOtp(String phone, String otp) {
        String storedOtp = registerOtpStorage.get(phone);
        LocalDateTime expiry = registerOtpExpiryStorage.get(phone);
        RegisterRequest req = pendingRegistrations.get(phone);

        if (storedOtp == null || expiry == null || req == null || !storedOtp.equals(otp)) {
            throw ApiException.badRequest("Mã OTP không hợp lệ hoặc đã qua sử dụng.");
        }
        if (LocalDateTime.now().isAfter(expiry)) {
            registerOtpStorage.remove(phone);
            registerOtpExpiryStorage.remove(phone);
            pendingRegistrations.remove(phone);
            throw ApiException.badRequest("Mã OTP đã hết hạn.");
        }
        if (customerRepository.existsByPhone(phone)) {
            registerOtpStorage.remove(phone);
            registerOtpExpiryStorage.remove(phone);
            pendingRegistrations.remove(phone);
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

        registerOtpStorage.remove(phone);
        registerOtpExpiryStorage.remove(phone);
        pendingRegistrations.remove(phone);

        String token = customerTokenProvider.generateToken(customer.getId(), customer.getPhone());
        return AuthResponse.builder()
                .status("SUCCESS")
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

    /**
     * Danh sách toàn bộ khách hàng cho màn quản lý của nhân viên (AdminAPI) — CHỈ ĐỌC, không có
     * method sửa/xoá thông tin khách nào ở đây hay ở AdminAPI. N+1 query (account/tier riêng từng
     * khách) chấp nhận được vì đây là danh sách quản trị, không phải API tần suất cao.
     */
    @Transactional(readOnly = true)
    public List<CustomerResponse> listAllForAdmin() {
        return customerRepository.findAll().stream()
                .map(customer -> {
                    LoyaltyAccount account = loyaltyAccountRepository.findByCustomerId(customer.getId()).orElse(null);
                    MembershipTier tier = (account != null && account.getCurrentTierId() != null)
                            ? membershipTierRepository.findById(account.getCurrentTierId()).orElse(null)
                            : null;
                    return toResponse(customer, account, tier);
                })
                .collect(Collectors.toList());
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
                .status(customer.getStatus() != null && customer.getStatus() == LoyaltyCodes.CUSTOMER_LOCKED ? "LOCKED" : "ACTIVE")
                .createdAt(customer.getCreatedAt())
                .build();
    }
}
