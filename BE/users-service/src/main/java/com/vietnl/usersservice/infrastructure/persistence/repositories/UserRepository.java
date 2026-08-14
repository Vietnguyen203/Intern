package com.vietnl.usersservice.infrastructure.persistence.repositories;

import com.vietnl.usersservice.domain.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);

    // LƯU Ý: cột email KHÔNG có ràng buộc unique ở entity/DB (UserValidator.validateCreate chỉ
    // kiểm tra trùng username, không kiểm tra trùng email) — trên thực tế đã có nhiều tài khoản
    // dùng chung 1 email. Vì vậy KHÔNG thêm findByEmail() ở đây (sẽ crash
    // NonUniqueResultException khi >1 kết quả) — luồng quên mật khẩu tra theo username
    // (findByUsername, luôn duy nhất) rồi mới đối chiếu email của đúng tài khoản đó.
    Optional<User> findByEmail(String email);
}
