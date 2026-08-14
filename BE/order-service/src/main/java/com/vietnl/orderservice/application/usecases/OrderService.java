package com.vietnl.orderservice.application.usecases;

import com.vietnl.orderservice.application.requests.CreateOrderRequest;
import com.vietnl.orderservice.application.requests.OrderItemRequest;
import com.vietnl.orderservice.application.requests.UpdateOrderItemRequest;
import com.vietnl.orderservice.application.responses.OrderResponse;
import com.vietnl.orderservice.domain.models.entities.Order;
import com.vietnl.orderservice.domain.models.entities.OrderItem;
import com.vietnl.orderservice.infrastructure.persistence.repositories.OrderItemRepository;
import com.vietnl.orderservice.infrastructure.persistence.repositories.OrderRepository;
import com.vietnl.orderservice.infrastructure.communication.CatalogFeignClient;
import com.vietnl.orderservice.infrastructure.communication.TableFeignClient;
import com.vietnl.orderservice.infrastructure.communication.NotificationFeignClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final NotificationFeignClient notificationFeignClient;
    private final TableFeignClient tableFeignClient;
    private final CatalogFeignClient catalogFeignClient;
    private final com.vietnl.orderservice.infrastructure.security.JwtUtil jwtUtil;

    // ===== TẠO ĐƠN HÀNG =====
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request, String username, String token) {
        Order order = new Order();
        order.setTableId(request.getTableId());
        
        String authToken = token != null ? (token.startsWith("Bearer ") ? token : "Bearer " + token) : "Bearer " + jwtUtil.generateToken("system", "ADMIN");

        if (request.getTableId() != null) {
            String fetchedTableNum = fetchTableNumber(request.getTableId(), authToken);
            order.setTableNumber(fetchedTableNum != null ? fetchedTableNum : request.getTableNumber());
        } else {
            order.setTableNumber(request.getTableNumber());
        }
        
        order.setNote(request.getNote());
        order.setCreatedBy(username);
        order.setStatus("PENDING");

        // Thêm các món (null-safe: mobile book bàn có thể không kèm items)
        if (request.getItems() != null) {
            List<Map<String, Object>> itemsToDeduct = new java.util.ArrayList<>();
            for (OrderItemRequest itemReq : request.getItems()) {
                OrderItem item = new OrderItem();
                item.setOrder(order);
                item.setMenuItemId(itemReq.getMenuItemId());
                
                MenuItemDetails details = fetchMenuItem(itemReq.getMenuItemId(), authToken);
                assertItemAvailable(details, itemReq.getMenuItemId());
                if (details != null) {
                    item.setFoodName(details.getFoodName());
                    item.setUnitPrice(details.getPrice());
                } else {
                    item.setFoodName(itemReq.getFoodName());
                    item.setUnitPrice(itemReq.getUnitPrice());
                }
                item.setFoodImage(details != null && details.getImage() != null ? details.getImage() : itemReq.getFoodImage());

                item.setQuantity(itemReq.getQuantity());
                item.setNote(itemReq.getNote());
                item.setKitchenStatus("PENDING");
                order.getItems().add(item);

                itemsToDeduct.add(Map.of(
                        "menuItemId", item.getMenuItemId(),
                        "quantity", item.getQuantity()
                ));
            }
            performStockDeduction(itemsToDeduct, authToken);
            order.getItems().forEach(i -> i.setStockDeducted(true));
        }

        order.recalculateTotal();
        Order saved = orderRepository.save(order);

        // Gửi thông báo qua Kafka để hệ thống WebSocket thông báo và reload thời gian thực
        sendNotification(
                "Đơn hàng mới",
                "Có đơn hàng mới tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi"),
                "info",
                "KITCHEN"
        );

        // Báo cho table-service để gán đơn vào bàn (đổi màu thành OCCUPIED)
        if (request.getTableId() != null && token != null) {
            try {
                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.set("Authorization", authToken);
                headers.set("X-Server", "server-1"); 
                
                tableFeignClient.assignOrder(
                        UUID.fromString(request.getTableId()),
                        Map.of("orderId", saved.getId().toString()),
                        authToken,
                        "server-1"
                );
            } catch (Exception e) {
            }
        }

        return OrderResponse.from(saved);
    }

    // ===== TẠO ĐƠN HÀNG CÔNG KHAI (KHÁCH QUÉT QR) =====
    @Transactional
    public synchronized OrderResponse createPublicOrder(CreateOrderRequest request) {
        String systemToken = "Bearer " + jwtUtil.generateToken("system", "ADMIN");

        // ===== KIỂM TRA BÀN ĐÃ CÓ ĐƠN HÀNG ĐANG HOẠT ĐỘNG CHƯA =====
        // Ngăn Race Condition: 2 khách cùng scan QR một bàn cùng lúc
        if (request.getTableId() != null) {
            List<Order> activeOrders = orderRepository.findByTableIdAndStatusIn(
                    request.getTableId(), List.of("PENDING", "CONFIRMED")
            );
            if (!activeOrders.isEmpty()) {
                // Trả về đơn hàng đang hoạt động thay vì tạo mới
                return OrderResponse.from(activeOrders.get(0));
            }
        }

        Order order = new Order();
        order.setTableId(request.getTableId());

        if (request.getTableId() != null) {
            String fetchedTableNum = fetchTableNumber(request.getTableId(), systemToken);
            order.setTableNumber(fetchedTableNum != null ? fetchedTableNum : request.getTableNumber());
        } else {
            order.setTableNumber(request.getTableNumber());
        }

        order.setNote(request.getNote());
        order.setCreatedBy("Khách hàng (QR)");
        order.setStatus("PENDING");

        if (request.getItems() != null) {
            List<Map<String, Object>> itemsToDeduct = new java.util.ArrayList<>();
            for (OrderItemRequest itemReq : request.getItems()) {
                OrderItem item = new OrderItem();
                item.setOrder(order);
                item.setMenuItemId(itemReq.getMenuItemId());

                MenuItemDetails details = fetchMenuItem(itemReq.getMenuItemId(), systemToken);
                assertItemAvailable(details, itemReq.getMenuItemId());
                if (details != null) {
                    item.setFoodName(details.getFoodName());
                    item.setUnitPrice(details.getPrice());
                } else {
                    item.setFoodName(itemReq.getFoodName());
                    item.setUnitPrice(itemReq.getUnitPrice());
                }
                item.setFoodImage(details != null && details.getImage() != null ? details.getImage() : itemReq.getFoodImage());

                item.setQuantity(itemReq.getQuantity());
                item.setNote(itemReq.getNote());
                item.setKitchenStatus("PENDING");
                order.getItems().add(item);

                itemsToDeduct.add(Map.of(
                        "menuItemId", item.getMenuItemId(),
                        "quantity", item.getQuantity()
                ));
            }
            performStockDeduction(itemsToDeduct, systemToken);
            order.getItems().forEach(i -> i.setStockDeducted(true));
        }

        order.recalculateTotal();
        Order saved = orderRepository.save(order);

        sendNotification(
                "Đơn hàng mới từ mã QR",
                "Khách tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " vừa đặt món qua mã QR",
                "info",
                "KITCHEN"
        );

        // Báo cho table-service để gán đơn vào bàn bằng Internal Token
        if (request.getTableId() != null) {
            try {
                tableFeignClient.assignOrder(
                        UUID.fromString(request.getTableId()),
                        Map.of("orderId", saved.getId().toString()),
                        systemToken,
                        "server-1"
                );
            } catch (Exception e) {
            }
        }

        return OrderResponse.from(saved);
    }


    // ===== LẤY TẤT CẢ ĐƠN HÀNG =====
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(OrderResponse::from)
                .collect(Collectors.toList());
    }

    // ===== LẤY ĐƠN THEO STATUS =====
    public List<OrderResponse> getOrdersByStatus(String status) {
        return orderRepository.findByStatusOrderByCreatedAtDesc(status)
                .stream()
                .map(OrderResponse::from)
                .collect(Collectors.toList());
    }

    // ===== LẤY ĐƠN THEO ID =====
    @Transactional(readOnly = true)
    public OrderResponse getOrderById(UUID id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + id));
        return OrderResponse.from(order);
    }

    // ===== THÊM MÓN VÀO ĐƠN =====
    @Transactional
    public OrderResponse addItemToOrder(UUID orderId, OrderItemRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + orderId));

        if ("COMPLETED".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new RuntimeException("Không thể thêm món vào đơn hàng đã kết thúc");
        }

        String systemToken = "Bearer " + jwtUtil.generateToken("system", "ADMIN");
        MenuItemDetails details = fetchMenuItem(request.getMenuItemId(), systemToken);
        assertItemAvailable(details, request.getMenuItemId());

        order.getItems().stream()
                .filter(i -> i.getMenuItemId().equals(request.getMenuItemId()) && isSameNote(i.getNote(), request.getNote()))
                .findFirst()
                .ifPresentOrElse(
                    existing -> existing.setQuantity(existing.getQuantity() + request.getQuantity()),
                    () -> {
                        OrderItem item = new OrderItem();
                        item.setOrder(order);
                        item.setMenuItemId(request.getMenuItemId());
                        item.setFoodName(details != null ? details.getFoodName() : request.getFoodName());
                        item.setUnitPrice(details != null ? details.getPrice() : request.getUnitPrice());
                        item.setFoodImage(details != null && details.getImage() != null ? details.getImage() : request.getFoodImage());
                        item.setQuantity(request.getQuantity());
                        item.setNote(request.getNote());
                        item.setStockDeducted(true);
                        order.getItems().add(item);
                    }
                );
        
        performStockDeduction(List.of(Map.of(
                "menuItemId", request.getMenuItemId(),
                "quantity", request.getQuantity()
        )), systemToken);

        order.recalculateTotal();
        Order saved = orderRepository.save(order);
        sendNotification(
                "Đơn hàng cập nhật",
                "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " vừa được bổ sung món.",
                "info",
                "KITCHEN"
        );
        return OrderResponse.from(saved);
    }

    // ===== CẬP NHẬT MÓN TRONG ĐƠN =====
    @Transactional
    public OrderResponse updateOrderItem(UUID orderId, UUID itemId, UpdateOrderItemRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + orderId));

        OrderItem item = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Không tìm thấy món: " + itemId));

        int diff = request.getQuantity() - item.getQuantity();
        String systemToken = "Bearer " + jwtUtil.generateToken("system", "ADMIN");

        if (diff > 0) {
            performStockDeduction(List.of(Map.of("menuItemId", item.getMenuItemId(), "quantity", diff)), systemToken);
        } else if (diff < 0) {
            performStockRefund(List.of(Map.of("menuItemId", item.getMenuItemId(), "quantity", -diff)), systemToken);
        }

        item.setQuantity(request.getQuantity());
        if (request.getNote() != null) item.setNote(request.getNote());

        order.recalculateTotal();
        Order saved = orderRepository.save(order);
        sendNotification(
                "Đơn hàng cập nhật",
                "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " vừa được cập nhật.",
                "info",
                "KITCHEN"
        );
        return OrderResponse.from(saved);
    }

    // ===== XÓA MÓN KHỎI ĐƠN =====
    @Transactional
    public OrderResponse removeItemFromOrder(UUID orderId, UUID itemId, String token) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + orderId));

        // Trigger lazy load & tìm item
        List<OrderItem> items = order.getItems();
        OrderItem targetItem = items.stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Không tìm thấy món trong đơn hàng: " + itemId));

        // Kiểm tra trạng thái bếp — không cho xóa nếu bếp đã nhận
        String ks = targetItem.getKitchenStatus();
        if (ks != null && !ks.equals("PENDING")) {
            throw new RuntimeException(
                "Không thể xóa món \"" + targetItem.getFoodName()
                + "\" vì bếp đã nhận (trạng thái: " + ks + ")"
            );
        }

        if (targetItem.isStockDeducted()) {
            String systemToken = "Bearer " + jwtUtil.generateToken("system", "ADMIN");
            performStockRefund(List.of(Map.of(
                    "menuItemId", targetItem.getMenuItemId(),
                    "quantity", targetItem.getQuantity()
            )), systemToken);
        }

        // Dùng remove() để orphanRemoval=true kích hoạt đúng cách
        items.remove(targetItem);

        // Nếu đơn không còn món nào → tự động hủy đơn để tránh để lại đơn rỗng
        if (items.isEmpty()) {
            order.setStatus("CANCELLED");
            order.recalculateTotal();
            Order saved = orderRepository.save(order);
            sendNotification(
                    "Đơn hàng đã hủy",
                    "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " đã bị hủy (xóa hết món).",
                    "warning",
                    "ALL"
            );
            // Giải phóng bàn nếu không còn đơn PENDING/CONFIRMED nào khác
            if (order.getTableId() != null && token != null) {
                long activeCount = orderRepository.countByTableIdAndStatusIn(order.getTableId(), List.of("PENDING", "CONFIRMED"));
                if (activeCount == 0) {
                    try {
                        String authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;
                        tableFeignClient.assignOrder(
                                UUID.fromString(order.getTableId()),
                                Map.of("orderId", ""),
                                authToken,
                                "server-1"
                        );
                    } catch (Exception e) {
                    }
                }
            }
            return OrderResponse.from(saved);
        }

        order.recalculateTotal();
        Order saved = orderRepository.save(order);
        sendNotification(
                "Đơn hàng cập nhật",
                "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " vừa được xóa bớt món.",
                "info",
                "KITCHEN"
        );
        return OrderResponse.from(saved);
    }

    // ===== CẬP NHẬT TRẠNG THÁI ĐƠN =====
    @Transactional
    public OrderResponse updateOrderStatus(UUID orderId, String status, String token) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + orderId));
        order.setStatus(status);
        Order saved = orderRepository.save(order);

        if ("COMPLETED".equals(status)) {
            sendNotification(
                    "Đơn hàng hoàn thành",
                    "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " đã được thanh toán hoàn tất.",
                    "success",
                    "ALL"
            );
        } else if ("CANCELLED".equals(status)) {
            sendNotification(
                    "Đơn hàng đã hủy",
                    "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " đã bị hủy.",
                    "warning",
                    "ALL"
            );
        }

        if (("COMPLETED".equals(status) || "CANCELLED".equals(status)) && token != null) {
            // Hoàn trả kho cho tất cả món chưa hủy nếu đơn hàng bị HỦY TOÀN BỘ
            if ("CANCELLED".equals(status)) {
                List<Map<String, Object>> itemsToRefund = new java.util.ArrayList<>();
                for (OrderItem item : order.getItems()) {
                    if (item.isStockDeducted() && !"CANCELLED".equals(item.getKitchenStatus())) {
                        itemsToRefund.add(Map.of(
                                "menuItemId", item.getMenuItemId(),
                                "quantity", item.getQuantity()
                        ));
                        item.setStockDeducted(false);
                        item.setKitchenStatus("CANCELLED");
                    }
                }
                if (!itemsToRefund.isEmpty()) {
                    String authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;
                    performStockRefund(itemsToRefund, authToken);
                }
            }

            if (order.getTableId() != null) {
                long activeOrdersCount = orderRepository.countByTableIdAndStatusIn(order.getTableId(), List.of("PENDING", "CONFIRMED"));
                if (activeOrdersCount == 0) {
                    try {
                        String authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;
                        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                        headers.set("Authorization", authToken);
                        headers.set("X-Server", "server-1");
                        
                        tableFeignClient.assignOrder(
                                UUID.fromString(order.getTableId()),
                                Map.of("orderId", ""),
                                authToken,
                                "server-1"
                        );
                    } catch (Exception e) {
                    }
                }
            }
        }

        return OrderResponse.from(saved);
    }

    public String getCreatorByTable(String tableId) {
        return orderRepository.findByTableIdAndStatusIn(tableId, List.of("PENDING", "CONFIRMED"))
                .stream()
                .findFirst()
                .map(Order::getCreatedBy)
                .orElse("N/A");
    }

    // ===== XÓA ĐƠN HÀNG =====
    @Transactional
    public void cancelOrder(UUID orderId, String token) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng: " + orderId));
        if ("COMPLETED".equals(order.getStatus())) {
            throw new RuntimeException("Không thể hủy đơn hàng đã hoàn thành");
        }
        order.setStatus("CANCELLED");
        Order saved = orderRepository.save(order);
        sendNotification(
                "Đơn hàng đã hủy",
                "Đơn hàng tại bàn " + (saved.getTableNumber() != null ? saved.getTableNumber() : "mang đi") + " đã bị hủy.",
                "warning",
                "ALL"
        );

        List<Map<String, Object>> itemsToRefund = new java.util.ArrayList<>();
        for (OrderItem item : order.getItems()) {
            if (item.isStockDeducted() && !"CANCELLED".equals(item.getKitchenStatus())) {
                itemsToRefund.add(Map.of("menuItemId", item.getMenuItemId(), "quantity", item.getQuantity()));
                item.setStockDeducted(false);
                item.setKitchenStatus("CANCELLED");
            }
        }
        if (!itemsToRefund.isEmpty()) {
            String systemToken = "Bearer " + jwtUtil.generateToken("system", "ADMIN");
            performStockRefund(itemsToRefund, systemToken);
        }

        if (order.getTableId() != null && token != null) {
            long activeOrdersCount = orderRepository.countByTableIdAndStatusIn(order.getTableId(), List.of("PENDING", "CONFIRMED"));
            if (activeOrdersCount == 0) {
                try {
                    String authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;
                    org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                    headers.set("Authorization", authToken);
                    headers.set("X-Server", "server-1");
                    
                    tableFeignClient.assignOrder(
                            UUID.fromString(order.getTableId()),
                            Map.of("orderId", ""),
                            authToken,
                            "server-1"
                    );
                } catch (Exception e) {
                }
            }
        }
    }

    // ===== CẬP NHẬT TRẠNG THÁI BẾP =====
    @Transactional
    public void updateKitchenStatus(UUID itemId, String kitchenStatus, String token) {
        OrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy món: " + itemId));
        item.setKitchenStatus(kitchenStatus);

        if ("CANCELLED".equals(kitchenStatus) && item.isStockDeducted()) {
            if (token != null) {
                String authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;
                List<Map<String, Object>> itemsToRefund = List.of(Map.of(
                        "menuItemId", item.getMenuItemId(),
                        "quantity", item.getQuantity()
                ));
                performStockRefund(itemsToRefund, authToken);
                item.setStockDeducted(false);
            }
        }

        // Ép lưu xuống database
        orderItemRepository.save(item);
        orderItemRepository.flush();

        Order order = item.getOrder();
        String displayStatus = "PENDING".equals(kitchenStatus) ? "chờ chế biến" : 
                              "COOKING".equals(kitchenStatus) ? "đang nấu" : 
                              "READY".equals(kitchenStatus) ? "đã xong" : kitchenStatus;

        sendNotification(
                "Đơn hàng cập nhật",
                "Món '" + item.getFoodName() + "' tại bàn " + (order != null && order.getTableNumber() != null ? order.getTableNumber() : "") + " " + displayStatus,
                "info",
                "ALL"
        );
    }

    private void sendNotification(String title, String message, String type, String role) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                NotificationFeignClient.NotificationRequest payload = new NotificationFeignClient.NotificationRequest(title, message, type, role);
                notificationFeignClient.sendNotification(payload);
            } catch (Exception e) {
            }
        });
    }

    private boolean isSameNote(String note1, String note2) {
        String n1 = note1 == null ? "" : note1.trim();
        String n2 = note2 == null ? "" : note2.trim();
        return n1.equals(n2);
    }

    @lombok.Data
    private static class MenuItemDetails {
        private String foodName;
        private java.math.BigDecimal price;
        private String image;
        // ItemStatus (catalog-service): INACTIVE=0, ACTIVE=1, PENDING=2, REJECTED=-1 — trả nguyên số
        // (menu_items.status là cột Integer thô, không phải enum name) nên đọc đúng kiểu Number.
        private Integer status;
    }

    private MenuItemDetails fetchMenuItem(String menuItemId, String token) {
        try {
            Map<String, Object> response = catalogFeignClient.getMenuItemById(menuItemId, token);
            if (response != null && "200".equals(String.valueOf(response.get("code")))) {
                Map<String, Object> data = (Map<String, Object>) response.get("data");
                if (data != null) {
                    MenuItemDetails details = new MenuItemDetails();
                    details.setFoodName((String) data.get("foodName"));
                    Object priceObj = data.get("price");
                    if (priceObj instanceof Number) {
                        details.setPrice(new java.math.BigDecimal(priceObj.toString()));
                    }
                    Object imgObj = data.get("imageUrl");
                    if (imgObj == null) imgObj = data.get("image");
                    if (imgObj instanceof String) {
                        details.setImage((String) imgObj);
                    }
                    Object statusObj = data.get("status");
                    if (statusObj instanceof Number) {
                        details.setStatus(((Number) statusObj).intValue());
                    }
                    return details;
                }
            }
        } catch (Exception e) {
        }
        return null;
    }

    /**
     * Chặn đặt/thêm món khi biết CHẮC CHẮN món đó không ACTIVE (đã tắt bán, đang chờ duyệt, hoặc bị
     * từ chối) ở catalog-service — trước đây chỉ frontend lọc ở màn hình (foods.filter(status===1)),
     * backend không kiểm tra gì cả, nên 1 request POST /orders, /orders/public hay /orders/{id}/items
     * gửi thẳng vẫn tạo được đơn chứa món không bán (vd. frontend cache cũ, hoặc gọi API trực tiếp).
     * Chỉ chặn khi status đã biết và khác ACTIVE(1); nếu catalog-service không phản hồi được (details
     * hoặc status null) vẫn cho qua như hành vi cũ, để không làm gãy luồng đặt món chỉ vì
     * catalog-service tạm thời chậm/lỗi.
     */
    private void assertItemAvailable(MenuItemDetails details, String menuItemId) {
        if (details != null && details.getStatus() != null && details.getStatus() != 1) {
            String name = details.getFoodName() != null ? details.getFoodName() : menuItemId;
            throw new RuntimeException("Món \"" + name + "\" hiện không có sẵn để đặt (đã ngừng bán hoặc đang chờ duyệt).");
        }
    }

    private String fetchTableNumber(String tableId, String token) {
        try {
            Map<String, Object> response = tableFeignClient.getTableById(UUID.fromString(tableId), token);
            if (response != null && "200".equals(String.valueOf(response.get("code")))) {
                Map<String, Object> data = (Map<String, Object>) response.get("data");
                if (data != null && data.get("tableNumber") != null) {
                    return data.get("tableNumber").toString();
                }
            }
        } catch (Exception e) {
        }
        return null;
    }

    private void performStockDeduction(List<Map<String, Object>> itemsToDeduct, String token) {
        if (!itemsToDeduct.isEmpty()) {
            try {
                catalogFeignClient.deductStock(Map.of("items", itemsToDeduct), token);
            } catch (feign.FeignException e) {
                String msg = "Không đủ nguyên liệu!";
                try {
                    java.nio.ByteBuffer byteBuffer = e.responseBody().orElse(null);
                    if (byteBuffer != null) {
                        String body = java.nio.charset.StandardCharsets.UTF_8.decode(byteBuffer).toString();
                        com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
                        if (json.has("message")) msg = json.get("message").asText();
                    }
                } catch (Exception parseEx) { }
                throw new RuntimeException(msg);
            } catch (Exception e) {
                throw new RuntimeException("Lỗi hệ thống khi kiểm tra/khấu trừ kho!");
            }
        }
    }

    private void performStockRefund(List<Map<String, Object>> itemsToRefund, String token) {
        if (!itemsToRefund.isEmpty()) {
            try {
                catalogFeignClient.refundStock(Map.of("items", itemsToRefund), token);
            } catch (Exception e) {
            }
        }
    }
}
