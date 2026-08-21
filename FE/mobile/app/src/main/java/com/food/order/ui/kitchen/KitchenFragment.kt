package com.food.order.ui.kitchen

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.food.order.data.SessionManager
import com.food.order.data.model.KdsSettings
import com.food.order.databinding.FragmentKitchenBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class KitchenFragment : Fragment() {

    private var _binding: FragmentKitchenBinding? = null
    private val binding get() = _binding!!

    // AndroidViewModel -> cần factory, giống LoginViewModel
    private val viewModel: KitchenViewModel by viewModels {
        ViewModelProvider.AndroidViewModelFactory.getInstance(requireActivity().application)
    }

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }

    // Giá trị mới nhất từ các flow — gộp lại thủ công để dựng danh sách hiển thị thay vì combine()
    // 6+ flow cùng lúc (Flow.combine chỉ hỗ trợ tới 5 flow theo overload có sẵn).
    private var latestMode = KitchenViewMode.TABLE
    private var latestTableGroups: List<KitchenTableGroup> = emptyList()
    private var latestStatusGroups: List<KitchenStatusGroup> = emptyList()
    private var latestNow: Long = System.currentTimeMillis()
    private var latestThresholds: KdsSettings = KdsSettings.DEFAULT

    private val kitchenAdapter: KitchenAdapter by lazy {
        KitchenAdapter(
            rows = emptyList(),
            now = latestNow,
            thresholds = latestThresholds,
            getCookStart = { itemId -> viewModel.getCookStart(itemId) },
            onActionClick = { item, targetStatus ->
                viewModel.updateItemStatus(userToken, item.orderItemId, targetStatus)
            },
            onPrintClick = { item ->
                runCatching { KitchenTicketPrinter.printTicket(requireContext(), item) }
                    .onFailure { Toast.makeText(requireContext(), "Không in được phiếu: ${it.message}", Toast.LENGTH_SHORT).show() }
            },
            onCompleteAllClick = { items ->
                viewModel.completeAllItems(userToken, items)
            }
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentKitchenBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.rvKitchenItems.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = kitchenAdapter
        }

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.fetchKitchenItems(userToken)
        }

        binding.btnViewModeTable.setOnClickListener { viewModel.setViewMode(KitchenViewMode.TABLE) }
        binding.btnViewModeStatus.setOnClickListener { viewModel.setViewMode(KitchenViewMode.STATUS) }

        binding.btnKdsSettings.setOnClickListener {
            runCatching { findNavController().navigate(com.food.order.R.id.action_navigation_kitchen_to_navigation_kds_settings) }
        }

        binding.btnKiosk.setOnClickListener {
            viewModel.toggleKiosk(!binding.btnKiosk.isSelected)
        }

        registerObservers()
        viewModel.fetchKitchenItems(userToken)
    }

    override fun onStart() {
        super.onStart()
        // Load lại ngưỡng KDS mỗi khi quay lại màn (VD: vừa lưu ở màn Cài đặt) + bắt đầu vòng lặp
        // làm mới 30s + tick 15s (mirror auto-refresh interval bên Web, chỉ chạy khi màn Bếp đang mở).
        viewModel.reloadKdsSettings()
        viewModel.startAutoRefresh(userToken)
    }

    override fun onStop() {
        super.onStop()
        viewModel.stopAutoRefresh()
        exitKiosk() // rời màn thì luôn thoát Kiosk, tránh kẹt fullscreen/giữ sáng màn hình ở màn khác
    }

    private fun registerObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.viewModeFlow.collectLatest { mode ->
                    latestMode = mode
                    updateViewModeButtons(mode)
                    renderRows()
                }
            }
            launch {
                viewModel.groupedByTableFlow.collectLatest { groups ->
                    latestTableGroups = groups
                    renderRows()
                }
            }
            launch {
                viewModel.groupedByStatusFlow.collectLatest { groups ->
                    latestStatusGroups = groups
                    renderRows()
                }
            }
            launch {
                viewModel.kitchenItemsFlow.collectLatest { items ->
                    val pending = items.count { it.kitchenStatus == "PENDING" }
                    val cooking = items.count { it.kitchenStatus == "COOKING" }
                    val ready = items.count { it.kitchenStatus == "READY" }
                    binding.tvCounts.text = "$pending chờ · $cooking đang nấu · $ready sẵn sàng"
                }
            }
            launch {
                viewModel.categoryOptionsFlow.collectLatest { options ->
                    rebuildCategoryChips(options)
                }
            }
            launch {
                viewModel.categoryFilterFlow.collectLatest {
                    // chip đang chọn đổi -> chỉ cần vẽ lại màu chip (rebuildCategoryChips đã set listener
                    // đọc lại categoryOptionsFlow mỗi khi filter đổi để tránh lệch trạng thái)
                    rebuildCategoryChips(viewModel.categoryOptionsFlow.value)
                }
            }
            launch {
                viewModel.kdsSettingsFlow.collectLatest { settings ->
                    latestThresholds = settings
                    kitchenAdapter.updateTime(latestNow, latestThresholds)
                }
            }
            launch {
                viewModel.timeTickerFlow.collectLatest { now ->
                    latestNow = now
                    kitchenAdapter.updateTime(latestNow, latestThresholds)
                }
            }
            launch {
                viewModel.kioskModeFlow.collectLatest { enabled ->
                    binding.btnKiosk.isSelected = enabled
                    if (enabled) enterKiosk() else exitKiosk()
                }
            }
            launch {
                viewModel.loadingFlow.collectLatest { isLoading ->
                    binding.swipeRefresh.isRefreshing = isLoading
                }
            }
            launch {
                viewModel.errorFlow.collectLatest { error ->
                    Toast.makeText(requireContext(), error, Toast.LENGTH_SHORT).show()
                }
            }
            launch {
                viewModel.autoTransitionFlow.collectLatest { (item, newStatus) ->
                    val label = if (newStatus == "COOKING") "bắt đầu nấu" else "chuyển Sẵn sàng"
                    Toast.makeText(requireContext(), "⏱️ Tự động $label: ${item.foodName}", Toast.LENGTH_SHORT).show()
                    if (newStatus == "COOKING" && latestThresholds.autoPrintOnCooking) {
                        runCatching { KitchenTicketPrinter.printTicket(requireContext(), item) }
                    }
                }
            }
        }
    }

    private fun renderRows() {
        val isEmptyOverall = latestTableGroups.isEmpty() && latestStatusGroups.all { it.items.isEmpty() }
        binding.tvEmpty.isVisible = isEmptyOverall
        binding.rvKitchenItems.isVisible = !isEmptyOverall

        val rows = if (isEmptyOverall) {
            emptyList()
        } else if (latestMode == KitchenViewMode.TABLE) {
            latestTableGroups.map { g ->
                KitchenGroupRow(
                    headerTitle = g.tableNumber,
                    itemCountLabel = "${g.items.size} món",
                    showCompleteAll = g.items.any { it.kitchenStatus == "PENDING" || it.kitchenStatus == "COOKING" },
                    completeAllTargets = g.items,
                    items = g.items
                )
            }
        } else {
            latestStatusGroups.map { g ->
                KitchenGroupRow(
                    headerTitle = g.label,
                    itemCountLabel = "${g.items.size} món",
                    showCompleteAll = false,
                    completeAllTargets = emptyList(),
                    items = g.items
                )
            }
        }
        kitchenAdapter.updateData(rows)
    }

    private fun updateViewModeButtons(mode: KitchenViewMode) {
        val activeBg = "#11117F"; val inactiveBg = "#FFFFFF"
        val activeText = "#FFFFFF"; val inactiveText = "#11117F"
        runCatching {
            binding.btnViewModeTable.setBackgroundColor(android.graphics.Color.parseColor(if (mode == KitchenViewMode.TABLE) activeBg else inactiveBg))
            binding.btnViewModeTable.setTextColor(android.graphics.Color.parseColor(if (mode == KitchenViewMode.TABLE) activeText else inactiveText))
            binding.btnViewModeStatus.setBackgroundColor(android.graphics.Color.parseColor(if (mode == KitchenViewMode.STATUS) activeBg else inactiveBg))
            binding.btnViewModeStatus.setTextColor(android.graphics.Color.parseColor(if (mode == KitchenViewMode.STATUS) activeText else inactiveText))
        }
    }

    private fun rebuildCategoryChips(options: List<String>) {
        val container = binding.containerCategoryFilter
        container.removeAllViews()
        if (options.size <= 1) {
            binding.scrollCategoryFilter.isVisible = false
            return
        }
        binding.scrollCategoryFilter.isVisible = true
        val selected = viewModel.categoryFilterFlow.value
        val paddingPx = (8 * resources.displayMetrics.density).toInt()
        val marginPx = (6 * resources.displayMetrics.density).toInt()
        options.forEach { cat ->
            val chip = TextView(requireContext()).apply {
                text = if (cat == "ALL") "Tất cả khu" else cat
                textSize = 12f
                setPadding(paddingPx * 2, paddingPx, paddingPx * 2, paddingPx)
                val isSelected = cat == selected
                setTextColor(android.graphics.Color.parseColor(if (isSelected) "#FFFFFF" else "#11117F"))
                setBackgroundColor(android.graphics.Color.parseColor(if (isSelected) "#11117F" else "#FFFFFF"))
                setOnClickListener { viewModel.setCategoryFilter(cat) }
            }
            val lp = ViewGroup.MarginLayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            lp.marginEnd = marginPx
            container.addView(chip, lp)
        }
    }

    private fun enterKiosk() {
        val window = requireActivity().window
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun exitKiosk() {
        val activity = activity ?: return
        val window = activity.window
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.show(WindowInsetsCompat.Type.systemBars())
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
