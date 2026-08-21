package com.food.order.ui.order

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.food.order.R
import com.food.order.data.request.CheckoutRequest
import com.food.order.databinding.DialogCheckoutBinding
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class CheckoutDialogFragment : DialogFragment() {

    private var _binding: DialogCheckoutBinding? = null
    private val binding get() = _binding!!
    private val viewModel: OrderTableViewModel by viewModels({ requireParentFragment() })

    // Lưu total hiện tại để dùng khi bấm thanh toán
    private var currentTotalAmount: Double? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, 0)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        _binding = DialogCheckoutBinding.inflate(requireActivity().layoutInflater)

        // Hiển thị tạm tổng tiền từ cache (nếu dialog từng mở trước đó trong cùng phiên bàn này),
        // rồi luôn gọi lại loadCheckoutSummary() bên dưới để lấy đủ TẤT CẢ đơn PENDING/CONFIRMED
        // hiện tại của bàn (tránh sót đơn "gọi thêm" mới tạo sau khi mở màn Order Table).
        val cachedSummary = viewModel.checkoutSummaryFlow.value
        cachedSummary?.let {
            currentTotalAmount = it.totalAmount
            updateTotalAndQr(it)
        }

        // Lắng nghe flow để cập nhật UI / kết quả
        collectFlows()

        viewModel.loadCheckoutSummary(userToken())

        val dialog = AlertDialog.Builder(requireContext())
            .setView(binding.root)
            .setTitle(getString(R.string.pay_title))
            .setPositiveButton(R.string.action_save, null) // set sau để validate
            .setNegativeButton(R.string.action_cancel, null)
            .create()

        dialog.setOnShowListener {
            val btn = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            btn.setOnClickListener {
                val total = currentTotalAmount ?: run {
                    Toast.makeText(requireContext(), "Chưa có tạm tính", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                viewModel.checkout(
                    userToken(),
                    CheckoutRequest(
                        paymentMethod = "TRANSFER",
                        amountReceived = total,
                        discount = 0.0,
                        note = "Thanh toan QR"
                    )
                )
            }
        }

        return dialog
    }

    private fun collectFlows() {
        lifecycleScope.launch {
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {

                // Cập nhật tổng tiền gộp & QR khi checkoutSummaryFlow thay đổi (thay cho
                // orderTotalFlow cũ chỉ theo dõi đúng 1 đơn — xem OrderTableViewModel.loadCheckoutSummary)
                launch {
                    viewModel.checkoutSummaryFlow.collect { summary ->
                        if (summary != null) {
                            currentTotalAmount = summary.totalAmount
                            updateTotalAndQr(summary)
                        }
                    }
                }

                // Khi checkout xong
                launch {
                    viewModel.checkoutFlow.collect {
                        Toast.makeText(requireContext(), "Thanh toán thành công!", Toast.LENGTH_SHORT).show()
                        dismissAllowingStateLoss()
                    }
                }

                // Lỗi chung
                launch {
                    viewModel.errorFlow.collect { msg ->
                        if (msg.isNotBlank()) {
                            Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
        }
    }

    private fun updateTotalAndQr(summary: OrderTableViewModel.CheckoutSummary) {
        val total = summary.totalAmount
        binding.tvTotal.text = getString(R.string.pay_total_0).replace("0 ₫", money(total))

        // Bàn có từ 2 đơn PENDING/CONFIRMED trở lên (VD: khách gọi thêm món) -> báo rõ đang gộp mấy
        // đơn để nhân viên không thắc mắc sao tổng tiền cao hơn đơn đang xem trên màn Order Table.
        binding.tvDialogSub.text = if (summary.orderCount > 1) {
            "Gộp ${summary.orderCount} đơn của bàn — " + getString(R.string.pay_subtitle)
        } else {
            getString(R.string.pay_subtitle)
        }

        if (total > 0) {
            val qrUrl = "https://img.vietqr.io/image/970407-19037974181012-print.jpg" +
                    "?amount=${total.toLong()}&addInfo=ThanhToan&accountName=NHA%20HANG"
            com.bumptech.glide.Glide.with(this)
                .load(qrUrl)
                .into(binding.ivQrCode)
        }
    }

    private fun money(v: Double): String {
        val nf = NumberFormat.getInstance(Locale("vi", "VN"))
        return nf.format(v) + " ₫"
    }

    private fun userToken(): String {
        return requireContext()
            .getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            .getString("token", "") ?: ""
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance(): CheckoutDialogFragment = CheckoutDialogFragment()
    }
}
