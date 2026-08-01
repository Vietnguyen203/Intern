package com.vietnl.catalogservice.application.usecases;

import com.vietnl.catalogservice.application.requests.MenuItemRequest;
import com.vietnl.catalogservice.domain.entities.MenuItem;
import com.vietnl.catalogservice.domain.enums.ExceptionMessage;
import com.vietnl.catalogservice.domain.enums.ItemStatus;
import com.vietnl.catalogservice.infrastructure.persistence.repositories.CategoryRepository;
import com.vietnl.catalogservice.infrastructure.persistence.repositories.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
public class MenuItemService {

    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository;

    @Value("${notification.service.url:http://localhost:8086}")
    private String notificationServiceUrl;

    public List<MenuItem> getAll(boolean includeProposals) {
        if (includeProposals) {
            return menuItemRepository.findAll();
        }
        return menuItemRepository.findByStatus(ItemStatus.ACTIVE.getValue());
    }

    public List<MenuItem> getByCategoryId(String categoryId, boolean includeProposals) {
        UUID categoryUuid = UUID.fromString(categoryId);
        if (includeProposals) {
            return menuItemRepository.findByCategoryId(categoryUuid);
        }
        return menuItemRepository.findByCategoryIdAndStatus(categoryUuid, ItemStatus.ACTIVE.getValue());
    }

    public MenuItem getById(String id) {
        return menuItemRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.ITEM_NOT_FOUND.getMessage()));
    }

    public MenuItem create(MenuItemRequest request) {
        if (!StringUtils.hasText(request.getCode()))
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "code"));
        if (!StringUtils.hasText(request.getFoodName()))
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "foodName"));
        if (request.getCategoryId() == null)
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "categoryId"));
        if (request.getPrice() == null || request.getPrice().compareTo(BigDecimal.ZERO) <= 0)
            throw new RuntimeException(ExceptionMessage.INVALID_PRICE.getMessage());

        // Validate category exists
        categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.CATEGORY_NOT_FOUND.getMessage()));

        if (menuItemRepository.findByCode(request.getCode()).isPresent())
            throw new RuntimeException(ExceptionMessage.ITEM_CODE_DUPLICATE.getMessage());

        MenuItem item = new MenuItem();
        item.setCategoryId(request.getCategoryId());
        item.setCode(request.getCode());
        item.setFoodName(request.getFoodName());
        item.setPrice(request.getPrice());
        item.setImageUrl(request.getImageUrl());
        item.setRecipe(request.getRecipe());
        item.setOptions(request.getOptions());
        item.setStatus(ItemStatus.ACTIVE.getValue());
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());

        return menuItemRepository.save(item);
    }

    public MenuItem update(String id, MenuItemRequest request) {
        MenuItem item = getById(id);

        if (request.getCategoryId() != null) {
            categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new RuntimeException(ExceptionMessage.CATEGORY_NOT_FOUND.getMessage()));
            item.setCategoryId(request.getCategoryId());
        }
        if (StringUtils.hasText(request.getCode()) && !request.getCode().equals(item.getCode())) {
            if (menuItemRepository.findByCode(request.getCode()).isPresent())
                throw new RuntimeException(ExceptionMessage.ITEM_CODE_DUPLICATE.getMessage());
            item.setCode(request.getCode());
        }
        if (StringUtils.hasText(request.getFoodName())) item.setFoodName(request.getFoodName());
        if (request.getPrice() != null && request.getPrice().compareTo(BigDecimal.ZERO) > 0) item.setPrice(request.getPrice());
        if (StringUtils.hasText(request.getImageUrl())) item.setImageUrl(request.getImageUrl());
        if (StringUtils.hasText(request.getRecipe())) item.setRecipe(request.getRecipe());
        if (request.getOptions() != null) item.setOptions(request.getOptions());
        item.setUpdatedAt(LocalDateTime.now());

        return menuItemRepository.save(item);
    }

    public void delete(String id) {
        getById(id);
        menuItemRepository.deleteById(UUID.fromString(id));
    }

    // ===== BẬT / TẮT MÓN ĂN (phục vụ tình huống hết/cảnh báo nguyên liệu) =====

    public MenuItem setAvailability(String id, boolean available) {
        MenuItem item = getById(id);
        // Chỉ áp dụng cho món đã ACTIVE/INACTIVE — món đang PENDING (chờ duyệt) hoặc đã bị từ chối
        // phải đi qua đúng luồng approve/reject, không bật/tắt trực tiếp qua đây.
        if (item.getStatus() != null
                && (item.getStatus().equals(ItemStatus.PENDING.getValue())
                    || item.getStatus().equals(ItemStatus.REJECTED.getValue()))) {
            throw new RuntimeException("Món đang ở trạng thái chờ duyệt/đã từ chối, không thể bật/tắt bán trực tiếp.");
        }
        item.setStatus(available ? ItemStatus.ACTIVE.getValue() : ItemStatus.INACTIVE.getValue());
        item.setUpdatedAt(LocalDateTime.now());
        return menuItemRepository.save(item);
    }

    // ===== PROPOSAL WORKFLOW =====

    public MenuItem propose(MenuItemRequest request) {
        if (!StringUtils.hasText(request.getCode()))
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "code"));
        if (!StringUtils.hasText(request.getFoodName()))
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "foodName"));
        if (request.getCategoryId() == null)
            throw new RuntimeException(String.format(ExceptionMessage.MISSING_REQUIRED_FIELD.getMessage(), "categoryId"));
        if (request.getPrice() == null || request.getPrice().compareTo(BigDecimal.ZERO) <= 0)
            throw new RuntimeException(ExceptionMessage.INVALID_PRICE.getMessage());

        categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new RuntimeException(ExceptionMessage.CATEGORY_NOT_FOUND.getMessage()));

        if (menuItemRepository.findByCode(request.getCode()).isPresent())
            throw new RuntimeException(ExceptionMessage.ITEM_CODE_DUPLICATE.getMessage());

        MenuItem item = new MenuItem();
        item.setCategoryId(request.getCategoryId());
        item.setCode(request.getCode());
        item.setFoodName(request.getFoodName());
        item.setPrice(request.getPrice());
        item.setImageUrl(request.getImageUrl());
        item.setRecipe(request.getRecipe());
        item.setOptions(request.getOptions());
        // Set status to PENDING
        item.setStatus(ItemStatus.PENDING.getValue());
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());

        return menuItemRepository.save(item);
    }

    public MenuItem approve(String id) {
        MenuItem item = getById(id);
        if (item.getStatus() != ItemStatus.PENDING.getValue()) {
            throw new RuntimeException("Chỉ có thể duyệt món đang ở trạng thái chờ (PENDING)");
        }
        item.setStatus(ItemStatus.ACTIVE.getValue());
        item.setUpdatedAt(LocalDateTime.now());
        MenuItem approved = menuItemRepository.save(item);
        sendNotification(
                "Đề xuất món ăn đã được duyệt",
                "Món '" + approved.getFoodName() + "' đã được Admin duyệt và đưa vào menu.",
                "success",
                "KITCHEN"
        );
        return approved;
    }

    public MenuItem reject(String id) {
        MenuItem item = getById(id);
        if (item.getStatus() != ItemStatus.PENDING.getValue()) {
            throw new RuntimeException("Chỉ có thể từ chối món đang ở trạng thái chờ (PENDING)");
        }
        menuItemRepository.delete(item);
        sendNotification(
                "Đề xuất món ăn bị từ chối",
                "Món '" + item.getFoodName() + "' đã bị Admin từ chối và không được đưa vào menu.",
                "warning",
                "KITCHEN"
        );
        return item;
    }

    public MenuItem proposeRecipe(String id, String newRecipe) {
        MenuItem item = getById(id);
        item.setPendingRecipe(newRecipe);
        item.setUpdatedAt(LocalDateTime.now());
        return menuItemRepository.save(item);
    }

    public MenuItem approveRecipe(String id) {
        MenuItem item = getById(id);
        if (item.getPendingRecipe() == null) {
            throw new RuntimeException("Không có đề xuất chỉnh sửa công thức nào.");
        }
        item.setRecipe(item.getPendingRecipe());
        item.setPendingRecipe(null);
        item.setUpdatedAt(LocalDateTime.now());
        return menuItemRepository.save(item);
    }

    public MenuItem rejectRecipe(String id) {
        MenuItem item = getById(id);
        item.setPendingRecipe(null);
        item.setUpdatedAt(LocalDateTime.now());
        return menuItemRepository.save(item);
    }

    private void sendNotification(String title, String message, String type, String role) {
        CompletableFuture.runAsync(() -> {
            try {
                RestTemplate restTemplate = new RestTemplate();
                restTemplate.postForEntity(
                        notificationServiceUrl + "/notifications/send",
                        Map.of(
                                "title", title,
                                "message", message,
                                "type", type,
                                "recipientRole", role
                        ),
                        Void.class
                );
            } catch (Exception e) {
            }
        });
    }
}
