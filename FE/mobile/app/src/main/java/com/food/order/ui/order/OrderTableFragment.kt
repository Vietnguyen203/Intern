package com.food.order.ui.order

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.food.order.R
import com.food.order.adapter.OrderFoodAdapter
import com.food.order.data.model.OrderItem
import com.food.order.databinding.FragmentOrderTableBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.DecimalFormat
import java.util.Collections

class OrderTableFragment : Fragment() {
    private var _binding: FragmentOrderTableBinding? = null
    private val binding get() = _binding!!
    private val viewModel: OrderTableViewModel by viewModels()

    // Chỉ tự động navigate sang màn gọi món 1 lần duy nhất khi mở bàn
    private var autoNavigated = false

    private val userToken: String by lazy {
        ("Bearer " + requireContext()
            .getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            .getString("token", ""))
    }

    private val adapter: OrderFoodAdapter by lazy {
        OrderFoodAdapter(Collections.emptyList()) { item ->
            AlertDialog.Builder(requireContext())
                .setTitle("Notification")
                .setMessage("Do you want to remove this item from your bill?")
                .setPositiveButton("OK") { dialog, _ ->
                    val foodId = extractFoodId(item)
                    if (foodId.isNullOrBlank()) {
                        Toast.makeText(requireContext(), "Cannot find foodId for this item", Toast.LENGTH_SHORT).show()
                    } else {
                        viewModel.removeItemFromOrder(requireContext(), userToken, foodId, item.quantity ?: 0)
                    }
                    dialog.dismiss()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    @SuppressLint("SetTextI18n")
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOrderTableBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.tableFlow.collectLatest {
                    binding.tvTableName.text = it?.name

                    // Tự động mở màn gọi món ngay lần đầu khi load xong thông tin bàn (kể cả chưa có order)
                    if (!autoNavigated && it != null) {
                        autoNavigated = true
                        val bundle = Bundle().apply { 
                            putString("orderId", viewModel.orderId ?: "")
                            putString("tableId", it.id)
                        }
                        findNavController().navigate(
                            R.id.action_navigation_order_table_to_navigation_order_food, bundle
                        )
                    }
                }
            }
            launch {
                viewModel.employeeOrderFlow.collectLatest {
                    binding.tvWaiter.text = it?.createdBy
                }
            }
            launch {
                viewModel.copyOrderFlow.collectLatest {
                    Toast.makeText(requireContext(), "Copy order successfully", Toast.LENGTH_SHORT).show()
                    viewModel.getDetailTable(userToken)
                }
            }
            launch {
                viewModel.orderFlow.collectLatest { order ->
                    val items = order.data.items ?: emptyList()
                    adapter.updateData(items)

                    binding.tvCreateAt.text = order.data.createdAt

                    val serverTotal = order.data.totalAmount ?: 0.0
                    val computedTotal = items.sumOf { (it.price ?: 0.0) * ((it.quantity ?: 0).toDouble()) }
                    val total = if (serverTotal > 0.0) serverTotal else computedTotal
                    binding.tvTotalAmount.text = formatVnd(total)

                    // Chỉ hiện nút "Xác nhận đặt món" khi đơn còn đang PENDING (chưa xác nhận)
                    binding.btnConfirm.visibility = if (order.status == "PENDING") View.VISIBLE else View.GONE
                }
            }
            launch {
                viewModel.cancelOrderFlow.collectLatest {
                    findNavController().popBackStack()
                }
            }
            launch {
                viewModel.confirmOrderFlow.collectLatest {
                    Toast.makeText(requireContext(), "Đã xác nhận đặt món — bếp bắt đầu nấu", Toast.LENGTH_SHORT).show()
                    viewModel.getDetailTable(userToken)
                }
            }
            launch {
                viewModel.completedOrderFlow.collectLatest {
                    Toast.makeText(requireContext(), "Completed order successfully", Toast.LENGTH_SHORT).show()
                    findNavController().popBackStack()
                }
            }
            launch {
                viewModel.checkoutFlow.collectLatest {
                    findNavController().popBackStack()
                }
            }
            launch {
                viewModel.removeItemFromOrderFlow.collectLatest {
                    Toast.makeText(requireContext(), "Remove item from order successfully", Toast.LENGTH_SHORT).show()
                    viewModel.getDetailTable(userToken)
                }
            }
            launch {
                viewModel.tablesFreeFlow.collectLatest {
                    if (it.isEmpty()) {
                        Toast.makeText(requireContext(), "There are no free tables", Toast.LENGTH_SHORT).show()
                    } else {
                        val tableNames = Array(it.size) { idx -> it[idx].name }
                        AlertDialog.Builder(context)
                            .setTitle("Choose a free table")
                            .setItems(tableNames) { dialog, which ->
                                dialog.dismiss()
                                viewModel.copyTableOrder(userToken, it[which].id)
                            }
                            .setNegativeButton("Cancel", null)
                            .show()
                    }
                }
            }
        }
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(true)
            adapter = this@OrderTableFragment.adapter
        }

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        binding.cardCopyOrder.setOnClickListener { viewModel.getTablesFromServer(userToken) }

        binding.btnCompleted.setOnClickListener {
            CheckoutDialogFragment.newInstance().show(childFragmentManager, "CheckoutDialog")
        }

        binding.btnConfirm.setOnClickListener {
            viewModel.confirmOrder(requireContext(), userToken)
        }

        binding.cardOrder.setOnClickListener {
            val bundle = Bundle().apply { 
                putString("orderId", viewModel.orderId ?: "")
                putString("tableId", viewModel.tableId ?: "")
            }
            findNavController().navigate(
                R.id.action_navigation_order_table_to_navigation_order_food, bundle
            )
        }

        binding.btnCancel.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Notification")
                .setMessage("Are you sure you want to cancel your order, Bitch?")
                .setPositiveButton("OK") { dialog, _ ->
                    viewModel.cancelOrder(requireContext(), userToken)
                    dialog.dismiss()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        viewModel.apply {
            setArguments(arguments)
            getDetailTable(userToken)
            getCreateByOrder(userToken)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun formatVnd(value: Double): String {
        return DecimalFormat("#,###").format(value) + " VNĐ"
    }

    /**
     * who read this is dog
     */
    private fun extractFoodId(item: OrderItem): String? {
        fun field(obj: Any?, name: String): Any? {
            if (obj == null) return null
            return try {
                val f = obj.javaClass.declaredFields.firstOrNull { it.name == name } ?: return null
                f.isAccessible = true
                f.get(obj)
            } catch (_: Exception) { null }
        }

        val directFoodId = field(item, "foodId")?.toString()
        if (!directFoodId.isNullOrBlank()) return directFoodId

        val directId = field(item, "id")?.toString()
        if (!directId.isNullOrBlank()) return directId

        val foodObj = field(item, "food")
        val nestedId = field(foodObj, "id")?.toString()
        if (!nestedId.isNullOrBlank()) return nestedId

        val nestedFoodId = field(foodObj, "foodId")?.toString()
        if (!nestedFoodId.isNullOrBlank()) return nestedFoodId

        return null
    }
}
