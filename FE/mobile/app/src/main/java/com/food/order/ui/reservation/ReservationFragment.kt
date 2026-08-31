package com.food.order.ui.reservation

import android.app.AlertDialog
import android.app.DatePickerDialog
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
import com.food.order.R
import com.food.order.adapter.ReservationAdapter
import com.food.order.data.SessionManager
import com.food.order.databinding.FragmentReservationBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Đặt bàn trước (theo ngày/giờ + số khách) — nhân viên xem danh sách của 1 ngày và có thể huỷ.
// Tạo mới lượt đặt được chuyển sang CreateReservationFragment (nút "+" góc phải).
class ReservationFragment : Fragment() {

    private var _binding: FragmentReservationBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReservationViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    private val selectedDay: Calendar = Calendar.getInstance()

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    private val displayDateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.US)

    private val adapter: ReservationAdapter by lazy {
        ReservationAdapter(emptyList()) { reservation ->
            AlertDialog.Builder(requireContext())
                .setTitle("Huỷ đặt bàn")
                .setMessage("Huỷ lượt đặt bàn của ${reservation.customerName}?")
                .setPositiveButton("Huỷ đặt bàn") { dialog, _ ->
                    val (from, to) = dayRangeIso()
                    viewModel.cancelReservation(userToken, reservation.id, from, to)
                    dialog.dismiss()
                }
                .setNegativeButton("Đóng", null)
                .show()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentReservationBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { binding.loadingView.isVisible = it }
            }
            launch {
                viewModel.reservationsFlow.collectLatest { list ->
                    binding.recyclerView.isVisible = list.isNotEmpty()
                    binding.ivEmpty.isVisible = list.isEmpty()
                    adapter.updateData(list)
                }
            }
            launch {
                viewModel.cancelFlow.collectLatest {
                    if (it) Toast.makeText(requireContext(), "Đã huỷ đặt bàn", Toast.LENGTH_SHORT).show()
                }
            }
            launch {
                viewModel.errorFlow.collectLatest { Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show() }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }
        binding.tvAddReservation.setOnClickListener {
            findNavController().navigate(R.id.navigation_create_reservation)
        }
        binding.tvSelectedDate.setOnClickListener { showDatePicker() }

        updateDateLabel()
        loadReservations()
    }

    override fun onResume() {
        super.onResume()
        loadReservations() // reload khi quay lại từ màn tạo mới
    }

    private fun showDatePicker() {
        DatePickerDialog(
            requireContext(),
            { _, year, month, dayOfMonth ->
                selectedDay.set(year, month, dayOfMonth)
                updateDateLabel()
                loadReservations()
            },
            selectedDay.get(Calendar.YEAR),
            selectedDay.get(Calendar.MONTH),
            selectedDay.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun updateDateLabel() {
        val today = Calendar.getInstance()
        val isToday = today.get(Calendar.YEAR) == selectedDay.get(Calendar.YEAR) &&
            today.get(Calendar.DAY_OF_YEAR) == selectedDay.get(Calendar.DAY_OF_YEAR)
        binding.tvSelectedDate.text = if (isToday) "Hôm nay (${displayDateFormat.format(selectedDay.time)})"
            else displayDateFormat.format(selectedDay.time)
    }

    private fun dayRangeIso(): Pair<String, String> {
        val from = selectedDay.clone() as Calendar
        from.set(Calendar.HOUR_OF_DAY, 0); from.set(Calendar.MINUTE, 0); from.set(Calendar.SECOND, 0)
        val to = from.clone() as Calendar
        to.add(Calendar.DAY_OF_MONTH, 1)
        return Pair(isoFormat.format(from.time), isoFormat.format(to.time))
    }

    private fun loadReservations() {
        if (userToken.isBlank()) return
        val (from, to) = dayRangeIso()
        viewModel.getReservations(userToken, from, to)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
