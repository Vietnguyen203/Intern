package com.vietnl.usersservice.domain.entities;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    // Ràng buộc UNIQUE thật ở DB — trước đây chỉ được kiểm tra ở tầng code (UserValidator), nên về
    // lý thuyết 2 request tạo tài khoản cùng username xảy ra đồng thời có thể lọt qua cả hai. Vì
    // project dùng ddl-auto=update, Hibernate sẽ tự thêm constraint này ở lần khởi động kế tiếp —
    // an toàn vì hiện chưa có username nào trùng nhau trong DB.
    @Column(unique = true)
    private String username;

    @Column(name = "password_hash")
    private String password;

    private Integer role;
    private Integer status;

    private String phoneNumber;
    private String fullName;
    private String email;

    private LocalDateTime birthday;

    private String citizenPid;
    
    @Column(name = "trusted_device")
    private UUID trustedDevice;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
