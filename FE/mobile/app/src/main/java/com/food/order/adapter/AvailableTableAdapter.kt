package com.food.order.adapter

import android.annotation.SuppressLint
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import androidx.core.content.ContextCompat
import com.food.order.R
import com.food.order.data.model.AvailableTableModel
import com.food.order.databinding.ItemAvailableTableBinding

class AvailableTableAdapter(
    private var data: List<AvailableTableModel>,
    private val onItemClick: (AvailableTableModel) -> Unit
) : RecyclerView.Adapter<AvailableTableAdapter.ViewHolder>() {

    private var selectedId: String? = null

    @SuppressLint("NotifyDataSetChanged")
    fun updateData(newData: List<AvailableTableModel>) {
        data = newData
        selectedId = null
        notifyDataSetChanged()
    }

    fun getSelected(): AvailableTableModel? = data.firstOrNull { it.id == selectedId }

    inner class ViewHolder(val binding: ItemAvailableTableBinding) : RecyclerView.ViewHolder(binding.root) {
        @SuppressLint("NotifyDataSetChanged")
        fun bind(item: AvailableTableModel) {
            binding.tvTableNumber.text = "Bàn ${item.tableNumber}"
            binding.tvCapacity.text = "${item.capacity} chỗ"

            val isSelected = item.id == selectedId
            val ctx = binding.root.context
            binding.cardRoot.setCardBackgroundColor(
                ContextCompat.getColor(ctx, if (isSelected) R.color.primary else R.color.bg_surface)
            )
            binding.tvTableNumber.setTextColor(ContextCompat.getColor(ctx, if (isSelected) R.color.white else R.color.text_primary))
            binding.tvCapacity.setTextColor(ContextCompat.getColor(ctx, if (isSelected) R.color.white else R.color.text_muted))

            binding.root.setOnClickListener {
                selectedId = item.id
                notifyDataSetChanged()
                onItemClick(item)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAvailableTableBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun getItemCount(): Int = data.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(data[position])
    }
}
