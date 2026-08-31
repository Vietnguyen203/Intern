//package com.food.order.ui.food
//
//import android.annotation.SuppressLint
//import android.app.Activity
//import android.content.Context
//import android.content.Intent
//import android.net.Uri
//import android.os.Bundle
//import android.provider.MediaStore
//import android.view.LayoutInflater
//import android.view.View
//import android.view.ViewGroup
//import android.widget.Toast
//import androidx.activity.result.ActivityResult
//import androidx.activity.result.ActivityResultLauncher
//import androidx.activity.result.contract.ActivityResultContracts
//import androidx.core.view.isVisible
//import androidx.fragment.app.Fragment
//import androidx.fragment.app.viewModels
//import androidx.lifecycle.lifecycleScope
//import androidx.navigation.fragment.findNavController
//import com.food.order.R
//import com.food.order.data.request.FoodRequest
//import com.food.order.databinding.FragmentCreateFoodBinding
//import kotlinx.coroutines.flow.collectLatest
//import kotlinx.coroutines.launch
//
//class CreateFoodFragment : Fragment() {
//
//    private var _binding: FragmentCreateFoodBinding? = null
//    private val binding get() = _binding!!
//    private val viewModel: FoodViewModel by viewModels()
//
//    private val userToken: String by lazy {
//        ("Bearer " + requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE).getString("token", ""))
//    }
//
//    private var imagePickerLauncher: ActivityResultLauncher<Intent> = registerForActivityResult(
//        ActivityResultContracts.StartActivityForResult()
//    ) { result: ActivityResult ->
//        if (result.resultCode == Activity.RESULT_OK) {
//            val data = result.data
//            if (data != null && data.data != null) {
//                viewModel.setImageUri(data.data!!)
//            }
//        }
//    }
//
//    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
//        _binding = FragmentCreateFoodBinding.inflate(inflater, container, false)
//
//        viewLifecycleOwner.lifecycleScope.launch {
//            launch {
//                viewModel.loadingFlow.collectLatest { result ->
//                    binding.loadingView.isVisible = result
//                }
//            }
//            launch {
//                viewModel.imageUriFlow.collectLatest { result ->
//                    binding.ivFoodImage.setImageURI(result)
//                }
//            }
//            launch {
//                viewModel.errorFlow.collectLatest { result ->
//                    Toast.makeText(requireContext(), result, Toast.LENGTH_SHORT).show()
//                }
//            }
//            launch {
//                viewModel.insertFlow.collectLatest { result ->
//                    if (result) {
//                        Toast.makeText(requireContext(), "Create food success", Toast.LENGTH_SHORT).show()
//                        findNavController().popBackStack()
//                    } else {
//                        Toast.makeText(requireContext(), "Create food failed", Toast.LENGTH_SHORT).show()
//                    }
//                }
//            }
//        }
//        return binding.root
//    }
//
//    @SuppressLint("IntentReset")
//    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
//        super.onViewCreated(view, savedInstanceState)
//
//        binding.cardViewBack.setOnClickListener {
//            findNavController().popBackStack()
//        }
//        binding.cardViewAvatar.setOnClickListener {
//            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
//            intent.type = "image/*"
//            imagePickerLauncher.launch(intent)
//        }
//        binding.btnCreate.setOnClickListener {
//            val name = binding.edtName.text.toString()
//            val price = binding.edtPrice.text.toString()
//            val unit = binding.edtUnit.text.toString()
//            val description = binding.edtDescription.text.toString()
//
//            val category = when (binding.radioGroupCategory.checkedRadioButtonId) {
//                R.id.rbMainCourse -> "MAIN_COURSE"
//                R.id.rbAppetizer -> "APPETIZER"
//                R.id.rbDessert -> "DESSERT"
//                R.id.rbBeverage -> "BEVERAGE"
//                else -> ""
//            }
//            if (userToken.isEmpty()) {
//                Toast.makeText(requireContext(), "Please login first", Toast.LENGTH_SHORT).show()
//                return@setOnClickListener
//            }
//            if (viewModel.imageUri == null) {
//                Toast.makeText(requireContext(), "Please select image", Toast.LENGTH_SHORT).show()
//                return@setOnClickListener
//            }
//            if (name.isEmpty()) {
//                binding.edtName.error = "Please enter name"
//                return@setOnClickListener
//            }
//            if (price.isEmpty()) {
//                binding.edtPrice.error = "Please enter price"
//                return@setOnClickListener
//            }
//            if (unit.isEmpty()) {
//                binding.edtUnit.error = "Please enter unit"
//                return@setOnClickListener
//            }
//            if (category.isEmpty()) {
//                Toast.makeText(requireContext(), "Please select category", Toast.LENGTH_SHORT).show()
//                return@setOnClickListener
//            }
//            val request = FoodRequest(
//                foodName = name,
//                price = price.toDouble(),
//                unit = unit,
//                category = category,
//                image = "",
//                description = description,
//            )
//            viewModel.createFood(requireContext(), userToken, request)
//        }
//    }
//
//    override fun onDestroyView() {
//        super.onDestroyView()
//        _binding = null
//    }
//}
package com.food.order.ui.food

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.food.order.R
import com.food.order.data.AppConstants
import com.food.order.data.SessionManager
import com.food.order.data.request.MenuItemRequest
import com.food.order.databinding.FragmentCreateFoodBinding
import com.food.order.ultis.SlugUtils
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class CreateFoodFragment : Fragment() {

    private var _binding: FragmentCreateFoodBinding? = null
    private val binding get() = _binding!!
    private val viewModel: FoodViewModel by viewModels()

    // Lấy token dạng "Bearer xxx" (rỗng nếu chưa đăng nhập)
    private val bearerToken: String
        get() = SessionManager.getBearerToken(requireContext())

    // Chọn ảnh: dùng GetContent cho gọn
    private val pickImage: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            uri?.let { viewModel.setImageUri(it) }
        }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateFoodBinding.inflate(inflater, container, false)

        // Observe
        viewLifecycleOwner.lifecycleScope.launch {
            launch {
                viewModel.loadingFlow.collectLatest { loading ->
                    binding.loadingView.isVisible = loading
                }
            }
            launch {
                viewModel.imageUriFlow.collectLatest { uri ->
                    binding.ivFoodImage.setImageURI(uri)
                }
            }
            launch {
                viewModel.errorFlow.collectLatest { message ->
                    Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
                }
            }
            launch {
                viewModel.insertFlow.collectLatest { ok ->
                    if (ok) {
                        Toast.makeText(requireContext(), "Create food success", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    } else {
                        Toast.makeText(requireContext(), "Create food failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // ===== Role guard: chỉ ADMIN =====
        // ⚠️ AppConstants.userModel là `lateinit var` — phải checkExistsUser() trước khi đọc.
        val rawRole: String? = if (AppConstants.checkExistsUser()) AppConstants.userModel.role else null
        val role = (rawRole ?: "UNKNOWN").uppercase()
        if (role != "ADMIN") {
            Toast.makeText(requireContext(), getString(R.string.admin_only), Toast.LENGTH_SHORT).show()
            findNavController().navigateUp()
            return
        }

        binding.cardViewBack.setOnClickListener { findNavController().popBackStack() }

        binding.cardViewAvatar.setOnClickListener {
            // Dùng GetContent mở picker ảnh
            pickImage.launch("image/*")
        }

        binding.btnCreate.setOnClickListener {
            // ===== Validate đăng nhập =====
            if (bearerToken.isBlank()) {
                Toast.makeText(requireContext(), "Please login first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // ===== Validate ảnh =====
            if (viewModel.imageUri == null) {
                Toast.makeText(requireContext(), "Please select image", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // ===== Validate form =====
            val name = binding.edtName.text?.toString()?.trim().orEmpty()
            val priceText = binding.edtPrice.text?.toString()?.trim().orEmpty()
            val unit = binding.edtUnit.text?.toString()?.trim().orEmpty()
            val description = binding.edtDescription.text?.toString()?.trim().orEmpty()

            val category = when (binding.radioGroupCategory.checkedRadioButtonId) {
                R.id.rbMainCourse -> "MAIN_COURSE"
                R.id.rbAppetizer  -> "APPETIZER"
                R.id.rbDessert    -> "DESSERT"
                R.id.rbBeverage   -> "BEVERAGE"
                else              -> ""
            }

            var hasError = false
            if (name.isEmpty()) {
                binding.edtName.error = "Please enter name"
                hasError = true
            }
            if (priceText.isEmpty()) {
                binding.edtPrice.error = "Please enter price"
                hasError = true
            }
            if (unit.isEmpty()) {
                binding.edtUnit.error = "Please enter unit"
                hasError = true
            }
            if (category.isEmpty()) {
                Toast.makeText(requireContext(), "Please select category", Toast.LENGTH_SHORT).show()
                hasError = true
            }
            if (hasError) return@setOnClickListener

            val price = priceText.toDoubleOrNull()
            if (price == null) {
                binding.edtPrice.error = "Invalid price"
                return@setOnClickListener
            }

            // ===== Tạo request (image url BE sẽ set trong ViewModel sau khi upload) =====
            val request = MenuItemRequest(
                code = SlugUtils.toSlug(name).uppercase(),
                foodName = name,
                price = price,
                categoryId = category,
                imageUrl = "" // sẽ cập nhật sau khi upload ảnh
            )

            // Gọi ViewModel: upload ảnh -> tạo món
            viewModel.createMenuItem(requireContext(), bearerToken, request)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
