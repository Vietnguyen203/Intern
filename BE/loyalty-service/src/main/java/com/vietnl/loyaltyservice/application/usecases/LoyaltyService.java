package com.vietnl.loyaltyservice.application.usecases;

import com.vietnl.loyaltyservice.adapter.exception.ApiException;
import com.vietnl.loyaltyservice.application.responses.PointTransactionResponse;
import com.vietnl.loyaltyservice.application.responses.RewardItemResponse;
import com.vietnl.loyaltyservice.application.responses.TierResponse;
import com.vietnl.loyaltyservice.domain.models.LoyaltyCodes;
import com.vietnl.loyaltyservice.domain.models.entities.LoyaltyAccount;
import com.vietnl.loyaltyservice.domain.models.entities.MembershipTier;
import com.vietnl.loyaltyservice.domain.models.entities.PointTransaction;
import com.vietnl.loyaltyservice.domain.models.entities.RewardItem;
import com.vietnl.loyaltyservice.domain.models.entities.VoucherRedemption;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.LoyaltyAccountRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.MembershipTierRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.PointTransactionRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.RewardItemRepository;
import com.vietnl.loyaltyservice.infrastructure.persistence.repositories.VoucherRedemptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoyaltyService {

    private static final String VOUCHER_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm (I,O,0,1)
    private static final int VOUCHER_CODE_LENGTH = 8;
    private static final int DEFAULT_POINTS_PER_VND = 10_000; // 1 điểm / 10.000đ chi tiêu, nhân theo hạng

    private final LoyaltyAccountRepository loyaltyAccountRepository;
    private final MembershipTierRepository membershipTierRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final RewardItemRepository rewardItemRepository;
    private final VoucherRedemptionRepository voucherRedemptionRepository;
    private final SecureRandom random = new SecureRandom();

    @Transactional(readOnly = true)
    public List<TierResponse> getTiers() {
        return membershipTierRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toTierResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RewardItemResponse> getActiveRewards() {
        return rewardItemRepository.findByActiveOrderByPointsCostAsc(LoyaltyCodes.REWARD_ACTIVE).stream()
                .map(this::toRewardResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PointTransactionResponse> getPointsHistory(UUID customerId) {
        return pointTransactionRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::toTransactionResponse)
                .collect(Collectors.toList());
    }

    /**
     * Cộng điểm khi thanh toán thành công — được gọi từ PaymentEventListener (Kafka).
     * Có validate idempotency (không cộng trùng cho cùng 1 orderId) và tự tính lại hạng.
     */
    @Transactional
    public void earnPointsForPayment(UUID customerId, UUID orderId, BigDecimal amount) {
        if (customerId == null) {
            log.info("Đơn hàng {} không gắn customerId -> bỏ qua, không tích điểm.", orderId);
            return;
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Bỏ qua tích điểm cho orderId={} vì amount không hợp lệ: {}", orderId, amount);
            return;
        }
        if (orderId != null && pointTransactionRepository.existsByOrderIdAndType(orderId, LoyaltyCodes.TX_EARN)) {
            log.info("orderId={} đã được cộng điểm trước đó -> bỏ qua (chống trùng do Kafka retry).", orderId);
            return;
        }

        LoyaltyAccount account = loyaltyAccountRepository.findByCustomerIdForUpdate(customerId)
                .orElseGet(() -> loyaltyAccountRepository.save(LoyaltyAccount.builder()
                        .customerId(customerId).currentPoints(0).totalSpent(BigDecimal.ZERO).build()));

        MembershipTier currentTier = account.getCurrentTierId() != null
                ? membershipTierRepository.findById(account.getCurrentTierId()).orElse(null)
                : null;
        BigDecimal multiplier = (currentTier != null && currentTier.getPointMultiplier() != null)
                ? currentTier.getPointMultiplier() : BigDecimal.ONE;

        int basePoints = amount.divide(BigDecimal.valueOf(DEFAULT_POINTS_PER_VND), 0, RoundingMode.DOWN).intValue();
        int earnedPoints = BigDecimal.valueOf(basePoints).multiply(multiplier).setScale(0, RoundingMode.DOWN).intValue();

        account.setCurrentPoints(account.getCurrentPoints() + earnedPoints);
        account.setTotalSpent(account.getTotalSpent().add(amount));

        MembershipTier newTier = membershipTierRepository
                .findByMinTotalSpentLessThanEqualOrderBySortOrderDesc(account.getTotalSpent())
                .stream().findFirst().orElse(currentTier);
        if (newTier != null) account.setCurrentTierId(newTier.getId());
        loyaltyAccountRepository.save(account);

        // saveAndFlush (thay vì save) để buộc Hibernate insert ngay tại đây, trong try/catch này,
        // thay vì trì hoãn tới lúc flush/commit cuối method (lúc đó exception sẽ thoát ra ngoài, không
        // bắt được gọn gàng nữa). Ràng buộc UNIQUE (order_id, type) ở DB là lớp bảo vệ cuối cùng, phòng
        // trường hợp existsByOrderIdAndType() phía trên bị race (2 consumer/partition xử lý cùng orderId).
        try {
            pointTransactionRepository.saveAndFlush(PointTransaction.builder()
                    .customerId(customerId)
                    .orderId(orderId)
                    .type(LoyaltyCodes.TX_EARN)
                    .points(earnedPoints)
                    .note("Tích điểm từ đơn hàng #" + (orderId != null ? orderId.toString().substring(0, 8) : "?"))
                    .build());
        } catch (DataIntegrityViolationException ex) {
            // Vi phạm ràng buộc UNIQUE (order_id, type) -> orderId này đã được cộng điểm rồi (race condition
            // hiếm gặp, ví dụ Kafka rebalance khiến cùng orderId bị xử lý đồng thời). Đánh dấu rollback toàn
            // bộ giao dịch (hoàn tác luôn phần cộng điểm account ở trên) rồi bỏ qua nhẹ nhàng, KHÔNG coi là
            // lỗi hệ thống và KHÔNG ném lại exception để tránh PaymentEventListener log như lỗi thật.
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            log.info("Sự kiện trùng lặp bị bỏ qua (duplicate event ignored) cho orderId={} — " +
                    "đã tồn tại giao dịch EARN cho đơn hàng này (race condition ở tầng ứng dụng).", orderId);
            return;
        }

        if (newTier != null && currentTier != null && !newTier.getId().equals(currentTier.getId())) {
            log.info("Khách {} lên hạng {} -> {}", customerId, currentTier.getRank(), newTier.getRank());
        }
    }

    /** Đổi điểm lấy voucher — có khoá dòng loyalty_account để tránh đổi vượt quá điểm hiện có. */
    @Transactional
    public String redeemReward(UUID customerId, UUID rewardItemId) {
        RewardItem reward = rewardItemRepository.findById(rewardItemId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy ưu đãi này."));
        if (reward.getActive() == null || reward.getActive() != LoyaltyCodes.REWARD_ACTIVE) {
            throw ApiException.badRequest("Ưu đãi này hiện không còn mở để đổi.");
        }

        LoyaltyAccount account = loyaltyAccountRepository.findByCustomerIdForUpdate(customerId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản tích điểm."));
        if (account.getCurrentPoints() < reward.getPointsCost()) {
            throw ApiException.badRequest("Bạn không đủ điểm để đổi ưu đãi này.");
        }

        account.setCurrentPoints(account.getCurrentPoints() - reward.getPointsCost());
        loyaltyAccountRepository.save(account);

        pointTransactionRepository.save(PointTransaction.builder()
                .customerId(customerId)
                .type(LoyaltyCodes.TX_REDEEM)
                .points(-reward.getPointsCost())
                .note("Đổi điểm lấy: " + reward.getName())
                .build());

        String code = generateUniqueVoucherCode();
        voucherRedemptionRepository.save(VoucherRedemption.builder()
                .customerId(customerId)
                .rewardItemId(reward.getId())
                .code(code)
                .status(LoyaltyCodes.VOUCHER_ISSUED)
                .build());

        return code;
    }

    private String generateUniqueVoucherCode() {
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder sb = new StringBuilder(VOUCHER_CODE_LENGTH);
            for (int i = 0; i < VOUCHER_CODE_LENGTH; i++) {
                sb.append(VOUCHER_CODE_CHARS.charAt(random.nextInt(VOUCHER_CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (!voucherRedemptionRepository.existsByCode(code)) return code;
        }
        throw new IllegalStateException("Không sinh được mã voucher duy nhất, thử lại sau.");
    }

    private TierResponse toTierResponse(MembershipTier t) {
        return TierResponse.builder()
                .id(t.getId()).rank(t.getRank()).name(t.getName())
                .minTotalSpent(t.getMinTotalSpent()).discountPercent(t.getDiscountPercent())
                .pointMultiplier(t.getPointMultiplier()).color(t.getColor()).sortOrder(t.getSortOrder())
                .build();
    }

    private RewardItemResponse toRewardResponse(RewardItem r) {
        return RewardItemResponse.builder()
                .id(r.getId()).name(r.getName()).description(r.getDescription())
                .pointsCost(r.getPointsCost())
                .discountType(r.getDiscountType() == LoyaltyCodes.DISCOUNT_PERCENT ? "PERCENT" : "FIXED_AMOUNT")
                .discountValue(r.getDiscountValue())
                .build();
    }

    private PointTransactionResponse toTransactionResponse(PointTransaction tx) {
        String typeLabel = switch (tx.getType().intValue()) {
            case 0 -> "EARN";
            case 1 -> "REDEEM";
            case 2 -> "EXPIRE";
            default -> "ADJUST";
        };
        return PointTransactionResponse.builder()
                .id(tx.getId()).type(typeLabel).points(tx.getPoints())
                .note(tx.getNote()).createdAt(tx.getCreatedAt())
                .build();
    }
}
