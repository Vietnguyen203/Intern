package com.food.order.ui.order

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.food.order.adapter.FoodAdapter
import com.food.order.databinding.FragmentOrderFoodBinding
import com.food.order.ui.food.FoodViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import android.app.Dialog
import com.food.order.data.model.FoodModel
import com.food.order.databinding.DialogOrderOptionsBinding
import android.text.Editable
import android.text.TextWatcher
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.tabs.TabLayout
import java.util.Collections

class OrderFoodFragment : Fragment() {

    private var _binding: FragmentOrderFoodBinding? = null
    private val binding get() = _binding!!
    private val viewModel: FoodViewModel by viewModels()
    private val userToken: String by lazy {
        ("Bearer " + requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE).getString("token", ""))
    }
    private val adapter: FoodAdapter by lazy {
        FoodAdapter(Collections.emptyList(), { item ->
            showOrderOptionsDialog(item)
        }, true)
    }

    private var allFoods = listOf<FoodModel>()
    private var activeCategoryId: String? = null
    private var searchQuery: String = ""

    private fun filterFoods() {
        var filtered = allFoods
        if (searchQuery.isNotBlank()) {
            filtered = filtered.filter { it.foodName.contains(searchQuery, ignoreCase = true) }
        } else if (activeCategoryId != null) {
            filtered = filtered.filter { it.category == activeCategoryId }
        }

        binding.recyclerView.isVisible = filtered.isNotEmpty()
        binding.ivEmpty.isVisible = filtered.isEmpty()
        adapter.updateData(filtered)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOrderFoodBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest {
                    binding.loadingView.isVisible = it
                }
            }
            launch {
                viewModel.foodsFlow.collect { foods ->
                    allFoods = foods
                    filterFoods()
                }
            }
            launch {
                viewModel.categoriesFlow.collect { categories ->
                    binding.tabLayout.removeAllTabs()
                    for (cat in categories) {
                        val tab = binding.tabLayout.newTab().setText(cat.name).setTag(cat.id)
                        binding.tabLayout.addTab(tab)
                    }
                    if (categories.isNotEmpty() && activeCategoryId == null) {
                        activeCategoryId = categories[0].id
                        filterFoods()
                    }
                }
            }
            launch {
                viewModel.addOrderItemFlow.collectLatest {
                    Toast.makeText(requireContext(), "Đã thêm món vào order", Toast.LENGTH_SHORT).show()
                    // Bỏ tự động popBackStack để user có thể thêm nhiều món
                }
            }
            // ✅ Trước đây errorFlow không được lắng nghe ở màn này → lỗi thêm món (kể cả lỗi
            // "không đủ nguyên liệu trong kho" mới thêm) bị nuốt âm thầm, nhân viên không biết vì sao
            // món không được thêm. Giờ hiện rõ ra bằng Toast.
            launch {
                viewModel.errorFlow.collectLatest { msg ->
                    if (msg.isNotBlank()) {
                        Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        binding.btnDone.setOnClickListener {
            findNavController().popBackStack()
        }

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            setHasFixedSize(true)
            adapter = this@OrderFoodFragment.adapter
        }
        binding.cardViewBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                activeCategoryId = tab?.tag as? String
                filterFoods()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchQuery = s.toString().trim()
                filterFoods()
            }
        })

        viewModel.getCategories(requireContext(), userToken)
        viewModel.getFoodsFromServer(requireContext(), userToken)
    }

    private fun showOrderOptionsDialog(item: FoodModel) {
        val dialog = Dialog(requireContext())
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val dialogBinding = DialogOrderOptionsBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.tvFoodName.text = item.foodName
        val formattedPrice = java.text.NumberFormat.getInstance(java.util.Locale("vi", "VN")).format(item.price ?: 0.0)
        dialogBinding.tvFoodPrice.text = "$formattedPrice ₫"

        val source = com.food.order.utils.ImageResolver.forFood(requireContext(), item.foodName, item.image)
        com.bumptech.glide.Glide.with(requireContext())
            .load(source)
            .placeholder(com.food.order.R.drawable.placeholder)
            .error(com.food.order.R.drawable.placeholder)
            .into(dialogBinding.ivFoodDialog)

        var quantity = 1

        dialogBinding.btnMinus.setOnClickListener {
            if (quantity > 1) {
                quantity--
                dialogBinding.tvQuantity.text = quantity.toString()
            }
        }

        dialogBinding.btnPlus.setOnClickListener {
            quantity++
            dialogBinding.tvQuantity.text = quantity.toString()
        }

        // ===== OPTIONS - Chip toggle style =====
        val selectedOptions = mutableSetOf<String>()
        val optionsList = item.options
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList()

        if (optionsList.isEmpty()) {
            dialogBinding.tvOptionsLabel.visibility = View.GONE
            dialogBinding.llOptionsContainer.visibility = View.GONE
        } else {
            dialogBinding.tvOptionsLabel.visibility = View.VISIBLE
            dialogBinding.llOptionsContainer.visibility = View.VISIBLE
            dialogBinding.llOptionsContainer.orientation = LinearLayout.VERTICAL

            // Chia options thành từng hàng, mỗi hàng 2 chip
            val chunked = optionsList.chunked(2)
            for (row in chunked) {
                val rowLayout = LinearLayout(requireContext()).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).also { it.topMargin = dpToPx(8) }
                }
                for (opt in row) {
                    val chip = buildOptionChip(opt, selectedOptions)
                    val params = LinearLayout.LayoutParams(0, dpToPx(40), 1f).also {
                        it.marginEnd = dpToPx(8)
                    }
                    chip.layoutParams = params
                    rowLayout.addView(chip)
                }
                // Nếu hàng chỉ có 1 chip, thêm spacer để giữ layout
                if (row.size == 1) {
                    val spacer = View(requireContext()).apply {
                        layoutParams = LinearLayout.LayoutParams(0, dpToPx(40), 1f)
                    }
                    rowLayout.addView(spacer)
                }
                dialogBinding.llOptionsContainer.addView(rowLayout)
            }
        }

        dialogBinding.btnCancel.setOnClickListener {
            dialog.dismiss()
        }

        dialogBinding.btnAdd.setOnClickListener {
            val manualNote = dialogBinding.etNote.text.toString().trim()
            val finalNoteBuilder = StringBuilder()
            if (selectedOptions.isNotEmpty()) {
                finalNoteBuilder.append("Tuỳ chọn: ").append(selectedOptions.joinToString(", "))
            }
            if (manualNote.isNotEmpty()) {
                if (finalNoteBuilder.isNotEmpty()) finalNoteBuilder.append(" | ")
                finalNoteBuilder.append("Ghi chú: ").append(manualNote)
            }

            viewModel.addOrderItem(
                requireContext(),
                userToken,
                requireArguments().getString("orderId") ?: "",
                requireArguments().getString("tableId") ?: "",
                item,
                quantity,
                finalNoteBuilder.toString()
            )
            dialog.dismiss()
        }

        dialog.show()
    }

    /** Tạo chip toggle button cho option */
    private fun buildOptionChip(label: String, selectedOptions: MutableSet<String>): TextView {
        return TextView(requireContext()).apply {
            text = label
            textSize = 13f
            gravity = android.view.Gravity.CENTER
            setTypeface(null, Typeface.NORMAL)
            setPadding(dpToPx(12), dpToPx(6), dpToPx(12), dpToPx(6))
            isClickable = true
            isFocusable = true

            fun updateStyle(selected: Boolean) {
                val bg = GradientDrawable().apply {
                    cornerRadius = dpToPx(20).toFloat()
                    if (selected) {
                        setColor(Color.parseColor("#11117F"))
                        setStroke(0, Color.TRANSPARENT)
                    } else {
                        setColor(Color.parseColor("#F4F6FB"))
                        setStroke(dpToPx(1), Color.parseColor("#CCCCCC"))
                    }
                }
                background = bg
                setTextColor(if (selected) Color.WHITE else Color.parseColor("#444444"))
            }

            updateStyle(false)

            setOnClickListener {
                val isNowSelected = !selectedOptions.contains(label)
                if (isNowSelected) selectedOptions.add(label) else selectedOptions.remove(label)
                updateStyle(isNowSelected)
            }
        }
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    // Dummy extension để tránh lỗi compile (flexWrap không cần thiết, đã dùng chunked)
    private fun LinearLayout.flexWrap() {
        orientation = LinearLayout.VERTICAL
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
