package com.food.order.ui.kitchen

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.food.order.R
import com.food.order.data.model.KdsSettings
import com.food.order.databinding.ItemKitchenOrderBinding
import com.food.order.databinding.ItemKitchenSubItemBinding

/**
 * Render cả 2 chế độ xem (theo bàn / theo trạng thái) bằng CÙNG 1 danh sách [KitchenGroupRow] —
 * xem ghi chú ở KitchenModels.kt. Nhận `now`/`thresholds`/`getCookStart` để tính mức khẩn cấp +
 * đếm ngược tự động chuyển trạng thái, mirror KitchenTicket.jsx bên Web.
 *
 * Lưu ý: đếm ngược chỉ cập nhật mỗi lần updateTime() được gọi (ticker 15s từ KitchenViewModel),
 * KHÔNG chạy Handler riêng mỗi giây cho từng ViewHolder — đơn giản hoá hợp lý cho RecyclerView so
 * với useAutoCountdown mượt từng giây bên Web, không đổi ý nghĩa nghiệp vụ (vẫn tự chuyển đúng lúc).
 */
class KitchenAdapter(
    private var rows: List<KitchenGroupRow>,
    private var now: Long,
    private var thresholds: KdsSettings,
    private val getCookStart: (String) -> Long?,
    private val onActionClick: (KitchenItem, String) -> Unit,
    private val onPrintClick: (KitchenItem) -> Unit,
    private val onCompleteAllClick: (List<KitchenItem>) -> Unit
) : RecyclerView.Adapter<KitchenAdapter.VH>() {

    inner class VH(val b: ItemKitchenOrderBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemKitchenOrderBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val row = rows[position]
        holder.b.apply {
            tvTableNumber.text = row.headerTitle
            tvItemCount.text = row.itemCountLabel

            if (row.showCompleteAll && row.completeAllTargets.isNotEmpty()) {
                btnCompleteAll.visibility = View.VISIBLE
                btnCompleteAll.setOnClickListener { onCompleteAllClick(row.completeAllTargets) }
            } else {
                btnCompleteAll.visibility = View.GONE
            }

            containerItems.removeAllViews()
            val inflater = LayoutInflater.from(holder.itemView.context)
            row.items.forEach { item -> containerItems.addView(bindTicket(inflater, containerItems, item)) }
        }
    }

    private fun bindTicket(inflater: LayoutInflater, parent: ViewGroup, item: KitchenItem): View {
        val tb = ItemKitchenSubItemBinding.inflate(inflater, parent, false)

        tb.tvFoodName.text = item.foodName
        tb.tvQuantity.text = "x${item.quantity}"

        val ks = item.kitchenStatus
        val (statusText, statusColor, statusBg) = when (ks) {
            "PENDING" -> Triple("⏳ Chờ", "#D97706", "#FEF3C7")
            "COOKING" -> Triple("🔥 Nấu", "#EF4444", "#FEE2E2")
            "READY" -> Triple("✅ Sẵn sàng", "#10B981", "#D1FAE5")
            else -> Triple(ks, "#475569", "#F1F5F9")
        }
        tb.tvStatus.text = statusText
        runCatching {
            tb.tvStatus.setTextColor(android.graphics.Color.parseColor(statusColor))
            tb.tvStatus.setBackgroundColor(android.graphics.Color.parseColor(statusBg))
        }

        // Thời gian chờ + mức khẩn cấp
        val waited = getKitchenWaitMinutes(item, now)
        val urgency = getKitchenUrgency(item, now, thresholds)
        tb.tvWaitTime.text = if (waited > 0) "⏱️ $waited phút" else "⏱️ Vừa xong"
        val (waitColor, ticketBg) = when (urgency) {
            KitchenUrgency.CRITICAL -> "#DC2626" to R.drawable.bg_kds_ticket_critical
            KitchenUrgency.WARNING -> "#F59E0B" to R.drawable.bg_kds_ticket_warning
            KitchenUrgency.NORMAL -> "#64748B" to R.drawable.bg_kds_ticket_normal
        }
        runCatching { tb.tvWaitTime.setTextColor(android.graphics.Color.parseColor(waitColor)) }
        tb.cardTicketRoot.setBackgroundResource(ticketBg)
        if (urgency == KitchenUrgency.CRITICAL) {
            tb.tvWaitTime.text = "${tb.tvWaitTime.text} — QUÁ LÂU!"
        }

        if (!item.stationName.isNullOrBlank()) {
            tb.tvStation.visibility = View.VISIBLE
            tb.tvStation.text = item.stationName
        } else {
            tb.tvStation.visibility = View.GONE
        }

        if (!item.note.isNullOrBlank()) {
            tb.tvNote.visibility = View.VISIBLE
            tb.tvNote.text = "Ghi chú: ${item.note}"
        } else {
            tb.tvNote.visibility = View.GONE
        }

        // Mốc thời gian dự kiến tự động chuyển trạng thái (nếu ngưỡng tương ứng > 0) -> hiện đếm
        // ngược trên nút hành động, mirror autoTargetTime/countdownSeconds trong KitchenTicket.jsx.
        var autoTargetMs: Long? = null
        if (ks == "PENDING" && thresholds.autoStartMinutes > 0) {
            parseOrderDateMs(item.createdAt)?.let { autoTargetMs = it + thresholds.autoStartMinutes * 60000L }
        } else if (ks == "COOKING" && thresholds.autoReadyMinutes > 0) {
            val cookStart = getCookStart(item.orderItemId) ?: parseOrderDateMs(item.createdAt) ?: now
            autoTargetMs = cookStart + thresholds.autoReadyMinutes * 60000L
        }
        val countdownSec = autoTargetMs?.let { ((it - now) / 1000L).coerceAtLeast(0) }

        when (ks) {
            "PENDING" -> {
                tb.btnAction.isEnabled = true
                tb.btnAction.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#11117F"))
                tb.btnAction.text = when {
                    countdownSec == null -> "🔥 Nấu"
                    countdownSec > 0 -> "🔥 Tự nấu sau ${formatCountdown(countdownSec)}"
                    else -> "🔥 Nấu ngay"
                }
                tb.btnAction.setOnClickListener { onActionClick(item, "COOKING") }
            }
            "COOKING" -> {
                tb.btnAction.isEnabled = true
                tb.btnAction.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#10B981"))
                tb.btnAction.text = when {
                    countdownSec == null -> "✅ Xong"
                    countdownSec > 0 -> "✅ Tự xong sau ${formatCountdown(countdownSec)}"
                    else -> "✅ Xong ngay"
                }
                tb.btnAction.setOnClickListener { onActionClick(item, "READY") }
            }
            else -> { // READY — bếp chỉ nấu xong tới đây, waiter mới xác nhận trả món (bên tab Orders)
                tb.btnAction.isEnabled = false
                tb.btnAction.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#94A3B8"))
                tb.btnAction.text = "🔔 Chờ phục vụ trả bàn"
                tb.btnAction.setOnClickListener(null)
            }
        }

        tb.btnPrint.setOnClickListener { onPrintClick(item) }

        return tb.root
    }

    override fun getItemCount() = rows.size

    fun updateData(newRows: List<KitchenGroupRow>) {
        rows = newRows
        notifyDataSetChanged()
    }

    fun updateTime(newNow: Long, newThresholds: KdsSettings) {
        now = newNow
        thresholds = newThresholds
        notifyDataSetChanged()
    }
}
