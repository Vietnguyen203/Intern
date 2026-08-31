package com.food.order.ui.food

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.food.order.R
import com.food.order.data.SessionManager
import com.food.order.data.request.MenuItemRequest
import com.food.order.databinding.FragmentUpdateFoodBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import com.food.order.ultis.SlugUtils
import com.food.order.utils.ImageResolver  // ✅ dùng resolver ảnh local → remote

class UpdateFoodFragment : Fragment() {

    private var _binding: FragmentUpdateFoodBinding? = null
    private val binding get() = _binding!!

    private val userToken: String by lazy { SessionManager.getBearerToken(requireContext()) }
    private var imagePickerLauncher: ActivityResultLauncher<Intent> = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result: ActivityResult ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            if (data != null && data.data != null) {
                viewModel.setImageUri(data.data!!)
            }
        }
    }
    private val viewModel: FoodViewModel by viewModels()

    @SuppressLint("SetTextI18n")
    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentUpdateFoodBinding.inflate(inflater, container, false)

        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { result ->
                    if (result) {
                        binding.loadingView.show()
                    } else {
                        binding.loadingView.hide()
                    }
                }
            }
            launch {
                viewModel.imageUriFlow.collectLatest { result ->
                    binding.ivFoodImage.setImageURI(result)
                }
            }
            launch {
                viewModel.updateFlow.collectLatest { result ->
                    if (result) {
                        Toast.makeText(requireContext(), "Update food successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Update food failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.deleteFlow.collectLatest { result ->
                    if (result) {
                        Toast.makeText(requireContext(), "Delete food successfully", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Delete food failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            launch {
                viewModel.foodFlow.collectLatest { result ->
                    result?.let {
                        binding.edtName.setText(it.foodName)
                        binding.edtPrice.setText(it.price.toString())
                        binding.edtUnit.setText(it.unit)
                        binding.edtDescription.setText(it.description)
                        when (it.category) {
                            "MAIN_COURSE" -> binding.rbMainCourse.isChecked = true
                            "APPETIZER"   -> binding.rbAppetizer.isChecked = true
                            "DESSERT"     -> binding.rbDessert.isChecked = true
                            else          -> binding.rbBeverage.isChecked = true
                        }

                        // ✅ HIỂN THỊ ẢNH: ưu tiên drawable/assets theo tên món, fallback ảnh server (field image)
                        val source = ImageResolver.forFood(binding.root.context, it.foodName, it.image)
                        Glide.with(binding.root)
                            .load(source)
                            .placeholder(R.drawable.placeholder)
                            .error(R.drawable.placeholder)
                            .into(binding.ivFoodImage)
                    }
                }
            }
        }
        return binding.root
    }

    @SuppressLint("IntentReset")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.setArgument(arguments)

        binding.cardViewBack.setOnClickListener {
            findNavController().popBackStack()
        }
        binding.cardViewAvatar.setOnClickListener {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            intent.type = "image/*"
            imagePickerLauncher.launch(intent)
        }
        binding.btnUpdate.setOnClickListener {
            val name = binding.edtName.text.toString()
            val price = binding.edtPrice.text.toString()
            val unit = binding.edtUnit.text.toString()
            val description = binding.edtDescription.text.toString()

            val category = when (binding.radioGroupCategory.checkedRadioButtonId) {
                R.id.rbMainCourse -> "MAIN_COURSE"
                R.id.rbAppetizer  -> "APPETIZER"
                R.id.rbDessert    -> "DESSERT"
                R.id.rbBeverage   -> "BEVERAGE"
                else              -> ""
            }
            if (userToken.isEmpty()) {
                Toast.makeText(requireContext(), "Please login first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            // Nếu muốn KHÔNG bắt buộc chọn ảnh khi không dùng ảnh server,
            // có thể xoá khối kiểm tra image bên dưới.
            /*
            if (viewModel.imageUri == null && viewModel.editFood?.image.isNullOrEmpty()) {
                Toast.makeText(requireContext(), "Please select image", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            */
            if (name.isEmpty()) {
                binding.edtName.error = "Please enter name"
                return@setOnClickListener
            }
            if (price.isEmpty()) {
                binding.edtPrice.error = "Please enter price"
                return@setOnClickListener
            }
            if (unit.isEmpty()) {
                binding.edtUnit.error = "Please enter unit"
                return@setOnClickListener
            }
            if (category.isEmpty()) {
                Toast.makeText(requireContext(), "Please select category", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val request = MenuItemRequest(
                code = SlugUtils.toSlug(name).uppercase(),
                foodName = name,
                price = price.toDouble(),
                categoryId = category,
                imageUrl = viewModel.editFood?.image ?: "" // giữ link cũ nếu có
            )
            viewModel.updateMenuItem(requireContext(), userToken, request)
        }
        binding.btnRemove.setOnClickListener {
            viewModel.deleteMenuItem(requireContext(), userToken)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
