package com.vietnl.usersservice.adapter.apis;

import com.vietnl.usersservice.application.requests.LoginRequest;
import com.vietnl.usersservice.application.requests.ResetPasswordRequest;
import com.vietnl.usersservice.application.requests.UserRequest;
import com.vietnl.usersservice.application.requests.VerifyLoginOtpRequest;
import com.vietnl.usersservice.application.responses.LoginResponse;
import com.vietnl.usersservice.application.responses.UserResponse;
import com.vietnl.usersservice.application.usecases.UserService;
import com.vietnl.usersservice.domain.entities.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/users-service/request", "/users-service/request/"})
@RequiredArgsConstructor
public class UserAPI {

        private final UserService userService;

        // ===== LOGIN =====
        @PostMapping("/login")
        public ResponseEntity<?> login(@RequestBody LoginRequest request) {

                LoginResponse response = userService.login(
                                request.getUsername(),
                                request.getPassword(),
                                request.getDeviceId());

                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "status", response.getStatus(),
                                                "message", response.getMessage(),
                                                "token", response.getToken() != null ? response.getToken() : ""));
        }

        // ===== VERIFY OTP =====
        @PostMapping("/login/verify-otp")
        public ResponseEntity<?> verifyOtp(@RequestBody VerifyLoginOtpRequest request) {
                String username = request.getUsername();
                String otp = request.getOtp();
                String deviceId = request.getDeviceId();
                boolean rememberMe = Boolean.TRUE.equals(request.getRememberMe());

                LoginResponse response = userService.verifyLoginOtp(username, otp, deviceId, rememberMe);

                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "status", response.getStatus(),
                                                "message", response.getMessage(),
                                                "token", response.getToken()));
        }

        // ===== REGISTER (self-service, public — 2 bước qua OTP email) =====
        // LƯU Ý BẢO MẬT: role/status trong request bị bỏ qua hoàn toàn ở bước verify — luôn tạo ra
        // WAITER + ACTIVE. Không dùng UserRequest.role ở đây dù DTO có field đó (dùng chung DTO với
        // /create để tái dùng validate, không phải vì cho phép client chọn role).
        @PostMapping("/register")
        public ResponseEntity<?> register(@RequestBody UserRequest request) {
                LoginResponse response = userService.register(request);
                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "status", response.getStatus(),
                                                "message", response.getMessage()));
        }

        @PostMapping("/register/verify-otp")
        public ResponseEntity<?> verifyRegisterOtp(@RequestBody VerifyLoginOtpRequest request) {
                LoginResponse response = userService.verifyRegisterOtp(request.getUsername(), request.getOtp());
                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "status", response.getStatus(),
                                                "message", response.getMessage(),
                                                "token", response.getToken() != null ? response.getToken() : ""));
        }

        // ===== CREATE USER =====
        // ADMIN-only: trước đây endpoint này public hoàn toàn (không @PreAuthorize) trong khi
        // SecurityConfig permitAll() cả path /users-service/request/** — nghĩa là bất kỳ ai cũng có
        // thể tự tạo tài khoản ADMIN bằng cách POST thẳng, không cần đăng nhập. Khoá lại vì giờ đã có
        // cửa đăng ký công khai riêng (/register) — không nên để 2 cửa tạo tài khoản cùng mở.
        @PostMapping
        @PreAuthorize("hasRole('ADMIN')")
        public ResponseEntity<?> create(@RequestBody UserRequest request) {

                User createdUser = userService.create(request);

                return ResponseEntity.status(HttpStatus.CREATED)
                                .body(
                                                Map.of(
                                                                "code", "201",
                                                                "message", "User created",
                                                                "data", UserResponse.fromEntity(createdUser)));
        }

        // ===== COUNT ALL USERS =====
        @GetMapping("/count-by-server")
        public ResponseEntity<?> countByServer() {
                long count = userService.countAll();
                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "data", count));
        }

        // ===== GET USER BY ID =====
        @GetMapping("/{id}")
        @PreAuthorize("hasRole('ADMIN')")
        public ResponseEntity<?> getById(@PathVariable String id) {

                User user = userService.getById(id);

                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "data", UserResponse.fromEntity(user)));
        }

        // ===== GET ALL USERS =====
        @GetMapping
        @PreAuthorize("hasRole('ADMIN')")
        public ResponseEntity<?> getAll() {

                List<User> users = userService.getAll();
                List<UserResponse> responses = users.stream()
                                .map(UserResponse::fromEntity)
                                .collect(Collectors.toList());

                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "data", responses));
        }

        // ===== DELETE USER =====
        @DeleteMapping("/{id}")
        @PreAuthorize("hasRole('ADMIN')")
        public ResponseEntity<?> delete(@PathVariable String id) {

                userService.delete(id);

                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "message", "Deleted successfully"));
        }

        // ===== UPDATE USER INFO =====
        @PutMapping("/{id}")
        @PreAuthorize("hasRole('ADMIN')")
        public ResponseEntity<?> update(@PathVariable String id, @RequestBody UserRequest request) {
                User updatedUser = userService.update(id, request);
                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "message", "User updated",
                                                "data", UserResponse.fromEntity(updatedUser)));
        }

        // ===== UPDATE PASSWORD =====
        @PutMapping("/{id}/reset-password")
        public ResponseEntity<?> resetPassword(@PathVariable String id, @RequestBody ResetPasswordRequest request) {
                userService.resetPassword(id, request);
                return ResponseEntity.ok(
                                Map.of(
                                                "code", "200",
                                                "message", "Mật khẩu đã được thiết lập lại thành công"));
        }
}
