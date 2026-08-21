package com.food.order.ui.dashboard

import android.app.AlertDialog
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
import androidx.recyclerview.widget.GridLayoutManager
import com.food.order.R
import com.food.order.adapter.TableDashboardAdapter
import com.food.order.data.AppConstants
import com.food.order.data.SessionManager
import com.food.order.databinding.FragmentDashboardBinding
import com.food.order.ui.menu.SystemMenuDialog
import com.food.order.utils.DateUtils
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Collections

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!
    private val viewModel: DashboardViewModel by viewModels()

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    private val tableAdapter: TableDashboardAdapter by lazy {
        TableDashboardAdapter(Collections.emptyList()) { table ->
            if (table.currentOrderId != null) {
                val bundle = Bundle().apply { putString("tableId", table.id) }
                safeNavigate(R.id.action_navigation_dashboard_to_navigation_order_table, bundle)
            } else {
                AlertDialog.Builder(requireContext())
                    .setTitle("Notification")
                    .setMessage("Are you sure you want to book this table?")
                    .setPositiveButton("OK") { dialog, _ ->
                        viewModel.bookTable(table.id, userToken)
                        dialog.dismiss()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        registerObserver()
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        AppConstants.userModel?.let { u ->
            binding.tvEmployeeId.text = u.employeeId
            binding.tvName.text       = u.displayName
            binding.tvBirthday.text   = DateUtils.formatBirthday(u.birthday)
        } ?: run {
            binding.tvEmployeeId.text = ""
            binding.tvName.text       = ""
        }

        // Ẩn grid menu vì đã chuyển sang dialog
        binding.rvMenu.isVisible = false
        binding.rvMenu.adapter = null

        binding.recyclerView.apply {
            layoutManager = GridLayoutManager(requireContext(), 2)
            adapter = tableAdapter
            setHasFixedSize(true)
        }

        viewModel.getTablesFromServer(userToken)

        binding.ivMenu.isClickable = true
        binding.ivMenu.isFocusable = true
        binding.ivMenu.bringToFront()

        binding.ivMenu.setOnClickListener {
            val tag = "SYSTEM_MENU_DIALOG"
            val fm = parentFragmentManager
            if (fm.findFragmentByTag(tag) == null) {
                SystemMenuDialog.newInstance { featureId ->
                    when (featureId) {
                        "DASHBOARD"        -> Unit
                        "FOOD_MENU"        -> gotoFood() // CHANGED
                        "TABLES"           -> safeNavigate(R.id.navigation_table)
                        "ORDER_MANAGEMENT" -> safeNavigate(R.id.navigation_order_statistic)
                        "STAFF"            -> safeNavigate(R.id.navigation_staff)
                        "REPORTS"          -> safeNavigate(R.id.navigation_report)
                        "SETTINGS"         -> safeNavigate(R.id.navigation_settings)
                        "ORDER"            -> safeNavigate(R.id.navigation_order_table)
                        "KITCHEN"          -> safeNavigate(R.id.navigation_kitchen)
                        "INVENTORY"        -> safeNavigate(R.id.navigation_inventory)
                        "PROFILE"          -> safeNavigate(R.id.navigation_profile)
                        "LOGOUT"           -> safeNavigate(R.id.navigation_logout_dialog)
                    }
                }.show(fm, tag)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.getTablesFromServer(userToken)
        viewModel.startPolling(userToken)
    }

    override fun onPause() {
        super.onPause()
        viewModel.stopPolling()
    }

    private fun registerObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.tablesFlow.collectLatest { tables ->
                    tableAdapter.updateData(tables)
                    binding.apply {
                        recyclerView.isVisible = tables.isNotEmpty()
                        tvTotalTable.text = "${tables.size}"
                        tvTotalUseTable.text = "${tables.count { it.currentOrderId != null }}"
                    }
                }
            }
            launch {
                viewModel.errorFlow.collectLatest {
                    Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
                }
            }
            launch {
                viewModel.bookingFlow.collectLatest { bookedTableId ->
                    Toast.makeText(requireContext(), "Booking success", Toast.LENGTH_SHORT).show()
                    viewModel.getTablesFromServer(userToken)
                    val bundle = Bundle().apply { putString("tableId", bookedTableId) }
                    safeNavigate(R.id.action_navigation_dashboard_to_navigation_order_table, bundle)
                }
            }
        }
    }

    // CHANGED: chỉ điều hướng nếu đích tồn tại trong NavGraph hiện tại
    private fun gotoFood() {
        val nav = findNavController()
        val destId = R.id.navigation_food
        if (nav.graph.findNode(destId) != null) {
            runCatching { nav.navigate(destId) }
                .onFailure {
                    Toast.makeText(requireContext(),
                        "Không điều hướng được đến 'Food' (kiểm tra NavGraph).",
                        Toast.LENGTH_SHORT
                    ).show()
                }
        } else {
            Toast.makeText(
                requireContext(),
                "Không tìm thấy đích 'navigation_food' trong NavGraph. Hãy mở res/navigation/* và dùng đúng id của màn Food.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun safeNavigate(destId: Int, args: Bundle? = null) {
        val nav = findNavController()
        runCatching { nav.navigate(destId, args) }
            .onFailure {
                Toast.makeText(
                    requireContext(),
                    "Destination not found or not in current graph.",
                    Toast.LENGTH_SHORT
                ).show()
            }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
