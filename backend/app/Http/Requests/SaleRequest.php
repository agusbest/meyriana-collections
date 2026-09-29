<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_number' => [
                'required',
                'string',
                'max:100',
                Rule::unique('sales', 'order_number'),
            ],

            'marketplace_id' => [
                'required',
                'integer',
                'exists:marketplaces,id',
            ],

            'sale_date' => [
                'required',
                'date',
            ],

            'other_fee' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
            ],

            'items.*.product_variant_id' => [
                'required',
                'integer',
                // hanya variasi yang masih aktif yang boleh dijual
                Rule::exists('product_variants', 'id')->where('is_active', true),
            ],

            'items.*.qty' => [
                'required',
                'integer',
                'min:1',
            ],

            'items.*.selling_price' => [
                'required',
                'numeric',
                'min:0',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'order_number.required' => 'Nomor pesanan wajib diisi.',
            'order_number.unique' => 'Nomor pesanan sudah digunakan.',

            'marketplace_id.required' => 'Marketplace wajib dipilih.',
            'marketplace_id.exists' => 'Marketplace tidak ditemukan.',

            'sale_date.required' => 'Tanggal penjualan wajib diisi.',

            'other_fee.numeric' => 'Biaya lain harus berupa angka.',
            'other_fee.min' => 'Biaya lain tidak boleh kurang dari 0.',

            'items.required' => 'Minimal harus ada 1 item penjualan.',
            'items.min' => 'Minimal harus ada 1 item penjualan.',

            'items.*.product_variant_id.required' => 'Produk wajib dipilih.',
            'items.*.product_variant_id.exists' => 'Variasi produk tidak ditemukan atau sudah nonaktif.',

            'items.*.qty.required' => 'Qty wajib diisi.',
            'items.*.qty.min' => 'Qty minimal 1.',

            'items.*.selling_price.required' => 'Harga jual wajib diisi.',
            'items.*.selling_price.min' => 'Harga jual tidak boleh kurang dari 0.',
        ];
    }
}
