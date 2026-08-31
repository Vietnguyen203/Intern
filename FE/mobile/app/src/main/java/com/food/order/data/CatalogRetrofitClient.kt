package com.food.order.data

import android.content.Context
import com.google.gson.FieldNamingPolicy
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import com.food.order.BuildConfig

/**
 * RetrofitClient riêng cho catalog-service (port 8081).
 * Tự động lấy host từ RetrofitClient chính và đổi port thành 8081.
 */
object CatalogRetrofitClient {

    @Volatile private var _catalogApi: CatalogApiService? = null

    private fun buildCatalogBaseUrl(ctx: Context): String {
        return RetrofitClient.currentBaseUrl(ctx).removeSuffix("/") + "/catalog/"
    }

    @JvmStatic
    fun build(ctx: Context): CatalogApiService {
        val cached = _catalogApi
        if (cached != null) return cached

        return synchronized(this) {
            _catalogApi ?: createCatalogApi(ctx).also { _catalogApi = it }
        }
    }

    /** Gọi khi người dùng đổi server để rebuild cả catalog client */
    @JvmStatic
    fun invalidate() {
        _catalogApi = null
    }

    private fun createCatalogApi(ctx: Context): CatalogApiService {
        val baseUrl = buildCatalogBaseUrl(ctx)

        // ⚠️ SECURITY: chỉ log full body (có thể chứa password/JWT) ở bản debug; bản release
        // KHÔNG log body để tránh lộ dữ liệu nhạy cảm qua Logcat.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
            redactHeader("Authorization")
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(TokenInterceptor())
            .addInterceptor { chain ->
                val req = chain.request().newBuilder()
                    .header("X-Server", RetrofitClient.currentXServer(ctx))
                    .build()
                chain.proceed(req)
            }
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val gson = GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.IDENTITY) // catalog-service dùng camelCase
            .serializeNulls()
            .setLenient()
            .create()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(CatalogApiService::class.java)
    }

    /** Shortcut khi đã có context khởi tạo sẵn */
    @JvmStatic
    val instance: CatalogApiService
        get() {
            return _catalogApi
                ?: throw IllegalStateException("CatalogRetrofitClient not built yet. Call build(context) first.")
        }
}
