package com.food.order.ui.kitchen

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * "Máy in bếp" mô phỏng — mirror printKitchenTicket() bên Web (kitchenUtils.js): chưa có máy in
 * nhiệt thật để test nên vẽ phiếu ra 1 Bitmap (tương đương <canvas> bên Web) rồi lưu thành ảnh PNG
 * + mở màn hình Chia sẻ, coi như "tờ giấy" máy in nhả ra. Khi có máy in ESC/POS thật, chỉ cần thay
 * hàm printTicket() bằng lệnh gửi tới máy in, không cần đổi chỗ gọi ở Fragment.
 */
object KitchenTicketPrinter {

    private const val WIDTH = 560 // mô phỏng khổ giấy in nhiệt ~80mm (scale lớn hơn bản Web cho dễ đọc trên điện thoại)
    private const val PADDING = 28f

    fun printTicket(context: Context, item: KitchenItem) {
        val bitmap = renderTicket(item)
        val file = saveToFile(context, item, bitmap)
        shareTicket(context, file)
    }

    private fun renderTicket(item: KitchenItem): Bitmap {
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 30f; typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.DKGRAY; textSize = 16f; typeface = Typeface.MONOSPACE
            textAlign = Paint.Align.CENTER
        }
        val tablePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 24f; typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 28f; typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val notePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 20f; typeface = Typeface.create(Typeface.MONOSPACE, Typeface.ITALIC)
        }
        val metaPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; textSize = 18f; typeface = Typeface.MONOSPACE
        }
        val linePaint = Paint().apply { color = Color.BLACK; strokeWidth = 2f }

        val contentWidth = WIDTH - PADDING * 2
        val nameLines = wrapText(namePaint, "${item.quantity}x ${item.foodName}", contentWidth)
        val noteLines = if (!item.note.isNullOrBlank()) wrapText(notePaint, "Ghi chú: ${item.note}", contentWidth) else emptyList()
        val timeStr = SimpleDateFormat("HH:mm dd/MM/yyyy", Locale("vi", "VN")).format(java.util.Date())

        var height = PADDING + 36 + 28 + 18 // tiêu đề + phụ đề + gạch ngang
        height += 30 // tên bàn
        height += nameLines.size * 30 + 8
        if (noteLines.isNotEmpty()) height += noteLines.size * 24 + 8
        height += 24 // "Vào bếp:"
        height += 24 // "Mã đơn:"
        height += 18 + PADDING // gạch ngang cuối + padding dưới

        val bmp = Bitmap.createBitmap(WIDTH, height.toInt().coerceAtLeast(260), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.WHITE)

        var y = PADDING + 30
        c.drawText("PHIẾU BẾP", WIDTH / 2f, y, titlePaint); y += 28
        c.drawText("— mô phỏng máy in, chưa nối máy in thật —", WIDTH / 2f, y, subPaint); y += 18
        c.drawLine(PADDING, y, WIDTH - PADDING, y, linePaint); y += 24

        c.drawText(item.tableNumber, PADDING, y, tablePaint); y += 30

        nameLines.forEach { c.drawText(it, PADDING, y, namePaint); y += 30 }
        y += 8

        if (noteLines.isNotEmpty()) {
            noteLines.forEach { c.drawText(it, PADDING, y, notePaint); y += 24 }
            y += 8
        }

        c.drawText("Vào bếp: $timeStr", PADDING, y, metaPaint); y += 24
        c.drawText("Mã đơn: #${item.orderId}", PADDING, y, metaPaint); y += 24

        y += 8
        c.drawLine(PADDING, y, WIDTH - PADDING, y, linePaint)

        return bmp
    }

    private fun wrapText(paint: Paint, text: String, maxWidth: Float): List<String> {
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var line = ""
        words.forEach { word ->
            val test = if (line.isEmpty()) word else "$line $word"
            if (paint.measureText(test) > maxWidth && line.isNotEmpty()) {
                lines.add(line); line = word
            } else {
                line = test
            }
        }
        if (line.isNotEmpty()) lines.add(line)
        return lines
    }

    private fun saveToFile(context: Context, item: KitchenItem, bitmap: Bitmap): File {
        val dir = File(context.getExternalFilesDir(null), "kitchen_tickets").apply { mkdirs() }
        val safeTable = item.tableNumber.replace(Regex("\\s+"), "-")
        val safeFood = item.foodName.replace(Regex("\\s+"), "-")
        val file = File(dir, "phieu-bep_${safeTable}_${safeFood}_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, out) }
        return file
    }

    private fun shareTicket(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(intent, "Chia sẻ / Lưu phiếu bếp").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
