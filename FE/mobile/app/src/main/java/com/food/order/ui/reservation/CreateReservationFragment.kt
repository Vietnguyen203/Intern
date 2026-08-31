package com.food.order.ui.reservation

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.core.content.ContextCompat
import com.food.order.adapter.AvailableTableAdapter
import com.food.order.data.SessionManager
import com.food.order.data.mapper.toAvailableTableModel
import com.food.order.data.request.ReservationCreateRequest
import com.food.order.databinding.FragmentCreateReservationBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class CreateReservationFragment : Fragment() {

    private var _binding: FragmentCreateReservationBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReservationViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    private var selectedDateTime: Calendar? = null
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    private val displayFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.US)

    private val tableAdapter: AvailableTableAdapter by lazy {
        AvailableTableAdapter(emptyList()) { /* lưu lựa chọn trong adapter, đọc khi bấm Xác nhận */ }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateReservationBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { binding.loadingView.isVisible = it }
            }
            launch {
                viewModel.errorFlow.collectLatest { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
            }
            launch {
                viewModel.availableTablesFlow.collectLatest { list ->
                    val models = list.mapNotNull { it.toAvailableTableModel() }
                    tableAdapter.updateData(models)
                    binding.tvAvailableTablesLabel.isVisible = models.isNotEmpty()
                    binding.recyclerViewTables.isVisible = models.isNotEmpty()
                }
            }
            launch {
                viewModel.createFlow.collectLatest {
                    if (it) {
                        Toast.makeText(requireContext(), "Đặt bàn thành công", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    }
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.recyclerViewTables.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.recyclerViewTables.adapter = tableAdapter

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }
        binding.tvPickDateTime.setOnClickListener { showDateTimePicker() }
        binding.btnFindTables.setOnClickListener { onFindTablesClick() }
        binding.btnSubmit.setOnClickListener { onSubmitClick() }
    }

    private fun showDateTimePicker() {
        val now = Calendar.getInstance()
        DatePickerDialog(
            requireContext(),
            { _, year, month, dayOfMonth ->
                TimePickerDialog(
                    requireContext(),
                    { _, hourOfDay, minute ->
                        val picked = Calendar.getInstance()
                        picked.set(year, month, dayOfMonth, hourOfDay, minute, 0)
                        selectedDateTime = picked
                        binding.tvPickDateTime.text = displayFormat.format(picked.time)
                        binding.tvPickDateTime.setTextColor(
                            ContextCompat.getColor(requireContext(), com.food.order.R.color.text_primary)
                        )
                        // Đổi ngày/giờ thì danh sách bàn trống cũ (nếu đã tìm trước đó) không còn hợp lệ nữa
                        binding.tvAvailableTablesLabel.isVisible = false
                        binding.recyclerViewTables.isVisible = false
                        tableAdapter.updateData(emptyList())
                    },
                    now.get(Calendar.HOUR_OF_DAY),
                    now.get(Calendar.MINUTE),
                    true
                ).show()
            },
            now.get(Calendar.YEAR),
            now.get(Calendar.MONTH),
            now.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun onFindTablesClick() {
        val partySize = binding.edtPartySize.text.toString().trim().toIntOrNull()
        val dateTime = selectedDateTime

        if (userToken.isBlank()) {
            Toast.makeText(requireContext(), "Vui lòng đăng nhập lại", Toast.LENGTH_SHORT).show()
            return
        }
        if (partySize == null || partySize <= 0) {
            binding.edtPartySize.error = "Nhập số khách hợp lệ"
            return
        }
        if (dateTime == null) {
            Toast.makeText(requireContext(), "Vui lòng chọn ngày & giờ đặt bàn", Toast.LENGTH_SHORT).show()
            return
        }

        viewModel.findAvailableTables(userToken, isoFormat.format(dateTime.time), partySize)
    }

    private fun onSubmitClick() {
        val name = binding.edtCustomerName.text.toString().trim()
        val phone = binding.edtCustomerPhone.text.toString().trim()
        val partySize = binding.edtPartySize.text.toString().trim().toIntOrNull()
        val dateTime = selectedDateTime
        val table = tableAdapter.getSelected()

        if (userToken.isBlank()) {
            Toast.makeText(requireContext(), "Vui lòng đăng nhập lại", Toast.LENGTH_SHORT).show()
            return
        }
        if (name.isEmpty()) {
            binding.edtCustomerName.error = "Vui lòng nhập tên khách"
            return
        }
        if (partySize == null || partySize <= 0) {
            binding.edtPartySize.error = "Nhập số khách hợp lệ"
            return
        }
        if (dateTime == null) {
            Toast.makeText(requireContext(), "Vui lòng chọn ngày & giờ đặt bàn", Toast.LENGTH_SHORT).show()
            return
        }
        if (table == null) {
            Toast.makeText(requireContext(), "Vui lòng bấm \"Tìm bàn trống\" và chọn 1 bàn", Toast.LENGTH_SHORT).show()
            return
        }

        val request = ReservationCreateRequest(
            tableId = table.id,
            customerName = name,
            customerPhone = phone.ifBlank { null },
            partySize = partySize,
            reservedAt = isoFormat.format(dateTime.time)
        )
        viewModel.createReservation(userToken, request)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
