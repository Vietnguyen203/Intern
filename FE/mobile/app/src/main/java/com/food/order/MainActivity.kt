package com.food.order

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.food.order.data.RetrofitClient
import com.food.order.data.SessionManager
import com.food.order.databinding.ActivityMainBinding
import com.food.order.ui.settings.ServerAddressDialogFragment
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    override fun attachBaseContext(newBase: Context) {
        val lang = SessionManager.getLang(newBase)
        val locale = java.util.Locale(lang)
        java.util.Locale.setDefault(locale)
        
        val config = android.content.res.Configuration(newBase.resources.configuration)
        config.setLocale(locale)
        newBase.resources.updateConfiguration(config, newBase.resources.displayMetrics)
        
        val context = newBase.createConfigurationContext(config)
        super.attachBaseContext(context)
    }

    private lateinit var binding: ActivityMainBinding

    // Launcher xin quyền POST_NOTIFICATIONS (Android 13+)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        // ⚠️ CHANGED: KHÔNG gọi registerFcmToken() ở đây nữa — tại thời điểm này (onCreate, cold
        // launch) token đăng nhập vừa bị xoá bên dưới nên chưa có gì để gửi lên backend. Việc đăng
        // ký FCM token thật sự diễn ra ngay sau khi đăng nhập thành công, xem LoginFragment.
        if (granted) {
            android.util.Log.d("MainActivity", "POST_NOTIFICATIONS granted")
        } else {
            android.util.Log.w("MainActivity", "POST_NOTIFICATIONS denied by user")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Áp dụng ngôn ngữ trước khi super.onCreate để tải đúng tài nguyên giao diện
        val lang = SessionManager.getLang(this)
        val locale = java.util.Locale(lang)
        java.util.Locale.setDefault(locale)
        val config = android.content.res.Configuration(resources.configuration)
        config.setLocale(locale)
        resources.updateConfiguration(config, resources.displayMetrics)

        super.onCreate(savedInstanceState)

        // Clear token on fresh launch to enforce re-login after closing app
        // ⚠️ CHANGED: token giờ lưu trong EncryptedSharedPreferences (xem SessionManager), không còn
        // ở "app_prefs" plain nữa — dùng SessionManager.clearToken() thay vì xoá thẳng key "token"
        // khỏi getSharedPreferences("app_prefs", ...) (thao tác đó giờ không xoá được gì cả).
        if (savedInstanceState == null) {
            SessionManager.clearToken(this)
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
            val sys = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(sys.left, sys.top, sys.right, sys.bottom)
            insets
        }

        maybeAskServerOnce()
        // ⚠️ CHANGED: onCreate() chỉ còn xin quyền POST_NOTIFICATIONS (khởi tạo SDK-level, không
        // phụ thuộc phiên đăng nhập). KHÔNG gọi đăng ký FCM token lên backend ở đây nữa — trước đây
        // gọi ngay sau khi vừa xoá token (dòng "Clear token on fresh launch" ở trên) nên request
        // luôn no-op (SessionManager.getToken() null); và vì không có nơi nào gọi lại sau khi đăng
        // nhập thành công, thiết bị coi như không bao giờ nhận được push notification cho tới lần
        // cold-launch kế tiếp. Đăng ký token thật sự diễn ra ngay sau login, xem LoginFragment
        // (gọi MainActivity.registerFcmToken()).
        requestNotificationPermission()
    }

    /**
     * Xin quyền POST_NOTIFICATIONS (chỉ cần Android 13+, các bản trước tự động có quyền).
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    /**
     * Lấy FCM token từ Firebase và gửi lên backend — CHỈ nên gọi SAU KHI đăng nhập thành công (xem
     * LoginFragment), vì cần authToken hợp lệ trong SessionManager để gắn Authorization header.
     * No-op an toàn (return sớm) nếu chưa đăng nhập.
     */
    fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                android.util.Log.w("MainActivity", "FCM token fetch failed", task.exception)
                return@addOnCompleteListener
            }
            val fcmToken = task.result
            android.util.Log.d("MainActivity", "FCM token: $fcmToken")

            val authToken = SessionManager.getToken(this) ?: return@addOnCompleteListener
            val role = SessionManager.getRole(this) ?: "ALL"
            val bearerToken = "Bearer $authToken"

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val api = RetrofitClient.instance
                    api.registerFcmToken(bearerToken, mapOf(
                        "role" to role,
                        "fcmToken" to fcmToken,
                        "platform" to "ANDROID"
                    ))
                    android.util.Log.d("MainActivity", "FCM token registered to server")
                } catch (e: Exception) {
                    android.util.Log.e("MainActivity", "FCM token registration failed: ${e.message}")
                }
            }
        }
    }

    private fun maybeAskServerOnce() {
        val sp = getSharedPreferences("app_prefs", MODE_PRIVATE)
        val shown = sp.getBoolean("server_dialog_shown", false)
        if (!shown) {
            ServerAddressDialogFragment.newInstance()
                .show(supportFragmentManager, "server_dialog")
            sp.edit { putBoolean("server_dialog_shown", true) }
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_server -> {
                ServerAddressDialogFragment.newInstance()
                    .show(supportFragmentManager, "server_dialog")
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
