package com.food.order.ui.kitchen

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.food.order.data.SessionManager
import com.food.order.data.model.KdsSettings
import com.food.order.databinding.FragmentKdsSettingsBinding

/**
 * A3 — "Thêm màn Cài đặt ngưỡng KDS trên Mobile (lưu local trên máy đó bằng SharedPreferences,
 * không cần đồng bộ server — Web cũng đang lưu local, không lưu server-side)".
 */
class KdsSettingsFragment : Fragment() {

    private var _binding: FragmentKdsSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentKdsSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val current = SessionManager.getKdsSettings(requireContext())
        binding.edtWarningMinutes.setText(current.warningMinutes.toString())
        binding.edtCriticalMinutes.setText(current.criticalMinutes.toString())
        binding.edtAutoStartMinutes.setText(current.autoStartMinutes.toString())
        binding.edtAutoReadyMinutes.setText(current.autoReadyMinutes.toString())
        binding.switchAutoPrint.isChecked = current.autoPrintOnCooking

        binding.cardBack.setOnClickListener { findNavController().popBackStack() }

        binding.cardSave.setOnClickListener {
            val warning = binding.edtWarningMinutes.text.toString().toIntOrNull() ?: current.warningMinutes
            val critical = binding.edtCriticalMinutes.text.toString().toIntOrNull() ?: current.criticalMinutes
            val autoStart = binding.edtAutoStartMinutes.text.toString().toIntOrNull() ?: 0
            val autoReady = binding.edtAutoReadyMinutes.text.toString().toIntOrNull() ?: 0

            if (critical < warning) {
                Toast.makeText(requireContext(), "Ngưỡng 'Quá lâu' phải >= ngưỡng 'Cảnh báo'", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            SessionManager.saveKdsSettings(
                requireContext(),
                KdsSettings(
                    warningMinutes = warning.coerceAtLeast(1),
                    criticalMinutes = critical.coerceAtLeast(1),
                    autoStartMinutes = autoStart.coerceAtLeast(0),
                    autoReadyMinutes = autoReady.coerceAtLeast(0),
                    autoPrintOnCooking = binding.switchAutoPrint.isChecked
                )
            )
            Toast.makeText(requireContext(), "Đã lưu cài đặt Bếp", Toast.LENGTH_SHORT).show()
            findNavController().popBackStack()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
