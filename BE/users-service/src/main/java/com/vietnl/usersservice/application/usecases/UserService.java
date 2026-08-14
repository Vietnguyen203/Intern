package com.vietnl.usersservice.application.usecases;

import com.vietnl.usersservice.infrastructure.persistence.repositories.UserRepository;
import com.vietnl.usersservice.application.requests.ForgotPasswordRequest;
import com.vietnl.usersservice.application.requests.ResetPasswordRequest;
import com.vietnl.usersservice.application.requests.ResetPasswordWithOtpRequest;
import com.vietnl.usersservice.application.requests.UserRequest;
import com.vietnl.usersservice.application.security.JwtService;
import com.vietnl.usersservice.application.responses.LoginResponse;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;
import com.vietnl.usersservice.application.validators.UserValidator;
import com.vietnl.usersservice.domain.entities.User;
import com.vietnl.usersservice.domain.enums.UserRole;
import com.vietnl.usersservice.domain.enums.UserStatus;
import com.vietnl.usersservice.domain.enums.ExceptionMessage;
import lombok.RequiredArgsConstructor;
import java.util.HashMap;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserValidator userValidator;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JavaMailSender mailSender;

    private static final Map<String, String> otpStorage = new ConcurrentHashMap<>();
    private static final Map<String, LocalDateTime> otpExpiryStorage = new ConcurrentHashMap<>();

    // Đăng ký tài khoản (self-service, KHÔNG qua admin) — cùng cơ chế OTP trong bộ nhớ như login,
    // nhưng giữ tạm cả UserRequest đã validate (chưa lưu DB) vì user chưa tồn tại để tra cứu lại.
    private static final Map<String, UserRequest> pendingRegistrations = new ConcurrentHashMap<>();
    private static final Map<String, String> registerOtpStorage = new ConcurrentHashMap<>();
    private static final Map<String, LocalDateTime> registerOtpExpiryStorage = new ConcurrentHashMap<>();

    // Quên mật khẩu (public, tự phục vụ) — khoá theo USERNAME (Employee ID), giống các map OTP
    // khác. Trước đây khoá theo email nhưng email không unique trong hệ thống (nhiều tài khoản có
    // thể chung 1 email) nên không xác định được chính xác 1 tài khoản — bắt người dùng nhập thêm
    // username ở form Quên mật khẩu để loại bỏ hoàn toàn sự mập mờ này.
    private static final Map<String, String> forgotOtpStorage = new ConcurrentHashMap<>();
    private static final Map<String, LocalDateTime> forgotOtpExpiryStorage = new ConcurrentHashMap<>();

    public LoginResponse login(String username, String password, String deviceId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.USER_NOT_FOUND.getMessage()));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException(ExceptionMessage.INVALID_PASSWORD.getMessage());
        }

        // Nếu là ADMIN (giá trị 1), không cần OTP, trả về Token luôn
        if (user.getRole() == UserRole.ADMIN.getValue()) {
            Map<String, Object> claims = new HashMap<>();
            claims.put("role", UserRole.ADMIN.name());
            claims.put("fullName", user.getFullName());
            
            return LoginResponse.builder()
                    .status("SUCCESS")
                    .message("Đăng nhập Admin thành công")
                    .token(jwtService.generateToken(claims, username))
                    .build();
        }

        // Kiểm tra thiết bị tin cậy (Save Device)
        if (StringUtils.hasText(deviceId) && user.getTrustedDevice() != null) {
            try {
                UUID deviceUuid = UUID.fromString(deviceId);
                if (user.getTrustedDevice().equals(deviceUuid)) {
                    Map<String, Object> claims = new HashMap<>();
                    claims.put("role", UserRole.values()[user.getRole()].name());
                    claims.put("fullName", user.getFullName());
                    
                    return LoginResponse.builder()
                            .status("SUCCESS")
                            .message("Đăng nhập thiết bị tin cậy thành công")
                            .token(jwtService.generateToken(claims, username))
                            .build();
                }
            } catch (IllegalArgumentException e) {
                // deviceId không đúng định dạng UUID, bỏ qua
            }
        }

        // Generate OTP for other roles
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStorage.put(username, otp);
        otpExpiryStorage.put(username, LocalDateTime.now().plusMinutes(5));

        // Send Email
        sendOtpEmail(user.getEmail(), otp);

        return LoginResponse.builder()
                .status("REQUIRE_OTP")
                .message("Mã OTP đã được gửi về email của bạn")
                .build();
    }

    private void sendOtpEmail(String email, String otp) {

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("Mã OTP đăng nhập của bạn");
            message.setText("Mã OTP đăng nhập của bạn là: " + otp + ". Mã này có hiệu lực trong 5 phút.");
            mailSender.send(message);
        } catch (Exception e) {
            // Không thể gửi email OTP - lỗi được xử lý ngầm
        }
    }

    public LoginResponse verifyLoginOtp(String username, String otp, String deviceId, boolean rememberMe) {
        String storedOtp = otpStorage.get(username);
        LocalDateTime expiry = otpExpiryStorage.get(username);

        if (storedOtp == null || expiry == null || !storedOtp.equals(otp)) {
            throw new RuntimeException(ExceptionMessage.OTP_INVALID.getMessage());
        }

        if (LocalDateTime.now().isAfter(expiry)) {
            otpStorage.remove(username);
            otpExpiryStorage.remove(username);
            throw new RuntimeException(ExceptionMessage.OTP_EXPIRED.getMessage());
        }

        // Success - clear OTP and return token
        otpStorage.remove(username);
        otpExpiryStorage.remove(username);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.USER_NOT_FOUND.getMessage()));

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", UserRole.values()[user.getRole()].name());
        claims.put("fullName", user.getFullName());

        // Nếu người dùng chọn ghi nhớ thiết bị
        if (rememberMe && StringUtils.hasText(deviceId)) {
            try {
                UUID deviceUuid = UUID.fromString(deviceId);
                if (user.getTrustedDevice() == null || !user.getTrustedDevice().equals(deviceUuid)) {
                    user.setTrustedDevice(deviceUuid);
                    userRepository.save(user);
                }
            } catch (IllegalArgumentException e) {
                // deviceId không đúng định dạng UUID khi lưu thiết bị
            }
        }

        return LoginResponse.builder()
                .status("SUCCESS")
                .message("Đăng nhập thành công")
                .token(jwtService.generateToken(claims, username))
                .build();
    }

    /**
     * Tự đăng ký tài khoản (bước 1) — endpoint PUBLIC (xem UserAPI), nên KHÔNG được lưu User vào DB
     * ngay ở đây. Validate y hệt như tạo user bình thường (dùng lại UserValidator.validateCreate,
     * đảm bảo cùng 1 bộ quy tắc với màn Admin tạo nhân viên), giữ tạm request đã validate + gửi OTP
     * qua email; chỉ thực sự tạo user ở verifyRegisterOtp() sau khi OTP đúng.
     */
    public LoginResponse register(UserRequest request) {
        userValidator.validateCreate(request);

        String otp = String.format("%06d", new Random().nextInt(999999));
        pendingRegistrations.put(request.getUsername(), request);
        registerOtpStorage.put(request.getUsername(), otp);
        registerOtpExpiryStorage.put(request.getUsername(), LocalDateTime.now().plusMinutes(5));

        sendOtpEmail(request.getEmail(), otp);

        return LoginResponse.builder()
                .status("REQUIRE_OTP")
                .message("Mã OTP xác nhận đăng ký đã được gửi về email của bạn")
                .build();
    }

    /**
     * Tự đăng ký (bước 2) — xác nhận OTP rồi mới thực sự tạo user. Role/status KHÔNG lấy từ request
     * gốc dù request có gửi kèm gì đi nữa — luôn ép WAITER(0) + ACTIVE, vì đây là endpoint public,
     * không được phép tự phong bất kỳ role cao hơn nào cho chính mình.
     */
    public LoginResponse verifyRegisterOtp(String username, String otp) {
        String storedOtp = registerOtpStorage.get(username);
        LocalDateTime expiry = registerOtpExpiryStorage.get(username);
        UserRequest pending = pendingRegistrations.get(username);

        if (storedOtp == null || expiry == null || pending == null || !storedOtp.equals(otp)) {
            throw new RuntimeException(ExceptionMessage.OTP_INVALID.getMessage());
        }
        if (LocalDateTime.now().isAfter(expiry)) {
            registerOtpStorage.remove(username);
            registerOtpExpiryStorage.remove(username);
            pendingRegistrations.remove(username);
            throw new RuntimeException(ExceptionMessage.OTP_EXPIRED.getMessage());
        }

        // Username có thể đã bị người khác đăng ký trong lúc chờ OTP (hiếm nhưng vẫn kiểm tra lại).
        if (userRepository.findByUsername(username).isPresent()) {
            registerOtpStorage.remove(username);
            registerOtpExpiryStorage.remove(username);
            pendingRegistrations.remove(username);
            throw new RuntimeException(ExceptionMessage.USER_DUPLICATE.getMessage());
        }

        User user = new User();
        user.setUsername(pending.getUsername());
        user.setPassword(passwordEncoder.encode(pending.getPassword()));
        user.setRole(UserRole.WAITER.getValue());
        user.setStatus(UserStatus.ACTIVE.getValue());
        user.setPhoneNumber(pending.getPhoneNumber());
        user.setFullName(pending.getFullName());
        user.setEmail(pending.getEmail());
        user.setBirthday(pending.getBirthday());
        user.setCitizenPid(pending.getCitizenPid());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        registerOtpStorage.remove(username);
        registerOtpExpiryStorage.remove(username);
        pendingRegistrations.remove(username);

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", UserRole.WAITER.name());
        claims.put("fullName", user.getFullName());

        return LoginResponse.builder()
                .status("SUCCESS")
                .message("Đăng ký thành công")
                .token(jwtService.generateToken(claims, username))
                .build();
    }

    public User create(UserRequest request) {
        userValidator.validateCreate(request);

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        // Dùng role từ request nếu có, mặc định WAITER(0)
        user.setRole(request.getRole() != null ? request.getRole().getValue() : UserRole.WAITER.getValue());
        user.setStatus(UserStatus.ACTIVE.getValue());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setBirthday(request.getBirthday());
        user.setCitizenPid(request.getCitizenPid());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        return userRepository.save(user);
    }

    public User getById(String id) {
        return userValidator.validateExists(id);
    }

    public List<User> getAll() {
        return userRepository.findAll();
    }

    public long countAll() {
        return userRepository.count();
    }

    public void delete(String id) {
        userValidator.validateExists(id);
        userRepository.deleteById(UUID.fromString(id));
    }

    public User update(String id, UserRequest request) {
        User user = userValidator.validateExists(id);

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getPhoneNumber() != null) user.setPhoneNumber(request.getPhoneNumber());
        if (request.getBirthday() != null) user.setBirthday(request.getBirthday());
        if (request.getCitizenPid() != null) user.setCitizenPid(request.getCitizenPid());
        if (request.getRole() != null) user.setRole(request.getRole().getValue());
        if (request.getStatus() != null) user.setStatus(request.getStatus().getValue());

        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    public void resetPassword(String id, ResetPasswordRequest request) {
        User user = userValidator.validateExists(id);

        userValidator.validatePassword(request.getPassword());

        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);
    }

    /**
     * Quên mật khẩu (bước 1, public) — gửi OTP về email nếu username khớp đúng 1 tài khoản VÀ
     * email của tài khoản đó khớp email nhập vào. Bắt buộc cả 2 (không chỉ email) vì email không
     * unique trong hệ thống — chỉ dựa email thì không biết chính xác là tài khoản nào.
     * Cố tình KHÔNG báo lỗi khi không khớp (trả về bình thường như thành công) để tránh lộ thông
     * tin "username/email nào tồn tại trong hệ thống" cho người ngoài dò quét.
     */
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByUsername(request.getUsername())
                .filter(user -> user.getEmail() != null && user.getEmail().equalsIgnoreCase(request.getEmail()))
                .ifPresent(user -> {
                    String otp = String.format("%06d", new Random().nextInt(999999));
                    forgotOtpStorage.put(request.getUsername(), otp);
                    forgotOtpExpiryStorage.put(request.getUsername(), LocalDateTime.now().plusMinutes(5));
                    sendOtpEmail(user.getEmail(), otp);
                });
    }

    /**
     * Quên mật khẩu (bước 2, public) — xác thực OTP theo username rồi đổi mật khẩu luôn trong 1
     * lần gọi (không tách riêng bước "verify" như /register, vì FE cả web lẫn mobile đã viết sẵn
     * theo hướng gộp 1 request duy nhất).
     */
    public void resetPasswordWithOtp(ResetPasswordWithOtpRequest request) {
        String username = request.getUsername();
        String storedOtp = forgotOtpStorage.get(username);
        LocalDateTime expiry = forgotOtpExpiryStorage.get(username);

        if (storedOtp == null || expiry == null || !storedOtp.equals(request.getOtp())) {
            throw new RuntimeException(ExceptionMessage.OTP_INVALID.getMessage());
        }
        if (LocalDateTime.now().isAfter(expiry)) {
            forgotOtpStorage.remove(username);
            forgotOtpExpiryStorage.remove(username);
            throw new RuntimeException(ExceptionMessage.OTP_EXPIRED.getMessage());
        }

        userValidator.validatePassword(request.getPassword());

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.USER_NOT_FOUND.getMessage()));
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        forgotOtpStorage.remove(username);
        forgotOtpExpiryStorage.remove(username);
    }
}
