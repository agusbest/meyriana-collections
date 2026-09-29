<?php

namespace App\Http\Requests;

use App\Models\ProductVariant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $purchaseId = $this->route('purchase')?->id ?? $this->route('purchase');

        return [
            // Kosongkan agar nomor invoice dibuat otomatis (INV-YYYYMMDD-0001)
            'invoice_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('purchases', 'invoice_number')->ignore($purchaseId),
            ],

            'supplier_id' => [
                'required',
                'integer',
                'exists:suppliers,id',
            ],

            'purchase_date' => [
                'required',
                'date',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
            ],

            'items.*.product_variant_id' => [
                'required',
                'integer',
                'exists:product_variants,id',
            ],

            'items.*.qty' => [
                'required',
                'integer',
                'min:1',
            ],

            'items.*.price' => [
                'required',
                'numeric',
                'min:0',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'invoice_number.unique' => 'Nomor invoice sudah digunakan.',
            'supplier_id.required' => 'Supplier wajib dipilih.',
            'supplier_id.exists' => 'Supplier tidak ditemukan.',
            'purchase_date.required' => 'Tanggal pembelian wajib diisi.',
            'items.required' => 'Minimal harus ada 1 item pembelian.',
            'items.min' => 'Minimal harus ada 1 item pembelian.',
            'items.*.product_variant_id.required' => 'Produk wajib dipilih.',
            'items.*.product_variant_id.exists' => 'Variant produk tidak ditemukan.',
            'items.*.qty.required' => 'Qty wajib diisi.',
            'items.*.qty.min' => 'Qty minimal 1.',
            'items.*.price.required' => 'Harga beli wajib diisi.',
            'items.*.price.min' => 'Harga beli tidak boleh kurang dari 0.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $supplierId = $this->input('supplier_id');

                $variantIds = collect($this->input('items', []))
                    ->pluck('product_variant_id')
                    ->filter()
                    ->unique()
                    ->values();

                if (! $supplierId || $variantIds->isEmpty()) {
                    return;
                }

                $validCount = ProductVariant::whereIn('id', $variantIds)
                    ->whereHas('product', fn ($q) => $q->where('supplier_id', $supplierId))
                    ->count();

                if ($validCount !== $variantIds->count()) {
                    $validator->errors()->add(
                        'items',
                        'Semua item harus berasal dari produk milik supplier yang dipilih.'
                    );
                }
            },
        ];
    }
}
