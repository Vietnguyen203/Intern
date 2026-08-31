package com.vietnl.catalogservice.infrastructure.persistence.repositories;

import com.vietnl.catalogservice.domain.entities.Ingredient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IngredientRepository extends JpaRepository<Ingredient, UUID> {

    // SELECT ... FOR UPDATE — khoá đúng dòng nguyên liệu này cho tới khi transaction hiện tại
    // commit/rollback. Dùng khi kiểm tra-rồi-trừ (hoặc kiểm tra-rồi-cộng) tồn kho, để 2 request đồng
    // thời cho cùng 1 nguyên liệu không thể cùng đọc thấy số cũ rồi cùng ghi đè lên nhau (lost update /
    // oversell). Không dùng cho các thao tác đọc thông thường (getAllIngredients, ...) vì sẽ khoá không
    // cần thiết.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingredient i where i.id = :id")
    Optional<Ingredient> findByIdForUpdate(@Param("id") UUID id);
}
