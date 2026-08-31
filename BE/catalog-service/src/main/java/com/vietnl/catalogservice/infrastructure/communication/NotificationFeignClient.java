package com.vietnl.catalogservice.infrastructure.communication;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@FeignClient(name = "notification-service", url = "${notification.service.url}/notifications")
public interface NotificationFeignClient {

    @PostMapping("/send")
    void sendNotification(@RequestBody NotificationRequest request);

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    class NotificationRequest {
        private String title;
        private String message;
        private String type;
        private String recipientRole;
    }
}
