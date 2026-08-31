package com.food.order

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import com.food.order.data.KitchenRefreshBus
import com.food.order.data.RetrofitClient
import com.food.order.data.SessionManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FoodFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "food_order_channel"
        const val CHANNEL_NAME = "Food Order Notifications"
    }

    /**
     * Gọi khi thiết bị nhận được token FCM mới.
     * Gửi token này lên backend để đăng ký nhận push notification.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        android.util.Log.d("FCM", "New token: $token")
        sendTokenToServer(token)
    }

    /**
     * Gọi khi app đang foreground và nhận được FCM message.
     * Khi app ở background, hệ thống tự hiển notification.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Được thông báo mới"
        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["message"]
            ?: ""

        showLocalNotification(title, body)

        // Mirror Web (App.jsx, kênh /ws-notifications): tiêu đề liên quan đơn hàng/thanh toán thì
        // báo cho màn Bếp tự refetch, để món mới hiện ra ngay cả khi Bếp đang mở app (không chỉ dựa
        // vào pollingJob 30s). Xem KitchenRefreshBus để biết lý do chỉ phát tín hiệu, không kèm data.
        if (title.contains("Đơn hàng") || title.contains("Thanh toán")) {
            KitchenRefreshBus.notifyOrderChanged()
        }
    }

    private fun showLocalNotification(title: String, body: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Tạo notification channel (Android 8+)
        val channel = NotificationChannel(
            CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Thông báo đơn hàng và bếp"
            enableLights(true)
            enableVibration(true)
        }
        manager.createNotificationChannel(channel)
        manager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    private fun sendTokenToServer(token: String) {
        val context = applicationContext
        val savedToken = SessionManager.getToken(context) ?: return  // Chưa login — bỏ qua
        val role = SessionManager.getRole(context) ?: "ALL"
        val bearerToken = "Bearer $savedToken"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api = RetrofitClient.instance
                val body = mapOf(
                    "role" to role,
                    "fcmToken" to token,
                    "platform" to "ANDROID"
                )
                api.registerFcmToken(bearerToken, body)
                android.util.Log.d("FCM", "Token registered to server successfully")
            } catch (e: Exception) {
                android.util.Log.e("FCM", "Failed to register token: ${e.message}")
            }
        }
    }
}
