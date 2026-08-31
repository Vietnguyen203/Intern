package com.vietnl.tableservice.infrastructure.persistence;

import com.vietnl.tableservice.domain.entities.RestaurantTable;
import com.vietnl.tableservice.domain.enums.TableStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TableRepository extends JpaRepository<RestaurantTable, UUID> {
    List<RestaurantTable> findByStatus(TableStatus status);
    Optional<RestaurantTable> findByTableNumber(Integer tableNumber);
    boolean existsByTableNumber(Integer tableNumber);

    // SELECT ... FOR UPDATE — khoá đúng dòng bàn này cho tới khi transaction hiện tại commit/rollback.
    // Dùng khi kiểm tra-còn-trống-rồi-tạo lượt đặt bàn (createReservation), để 2 request đặt bàn gần
    // như đồng thời cho cùng 1 bàn/khung giờ không thể cùng đọc thấy "còn trống" rồi cùng tạo
    // reservation chồng lấn (double booking). Request thứ hai sẽ phải đợi transaction đầu commit rồi
    // mới đọc lại, lúc đó danh sách reservation đã có bản ghi vừa tạo nên bị chặn hợp lệ. Không dùng
    // cho các thao tác đọc thông thường (getAll, getByStatus, ...) vì sẽ khoá không cần thiết.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RestaurantTable t where t.id = :id")
    Optional<RestaurantTable> findByIdForUpdate(@Param("id") UUID id);
}
