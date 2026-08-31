package com.vietnl.tableservice.infrastructure.persistence;

import com.vietnl.tableservice.domain.entities.TableReservation;
import com.vietnl.tableservice.domain.enums.ReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TableReservationRepository extends JpaRepository<TableReservation, UUID> {
    List<TableReservation> findByTableIdAndStatus(UUID tableId, ReservationStatus status);
    List<TableReservation> findByStatusAndReservedAtBetween(ReservationStatus status, LocalDateTime from, LocalDateTime to);
}
