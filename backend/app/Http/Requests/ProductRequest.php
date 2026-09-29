<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $productId = $this->route('product')?->id ?? $this->route('product');

        return [
            'supplier_id' => [
                'required',
                'integer',
                'exists:suppliers,id',
            ],

            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->ignore($productId),
            ],

            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'category' => [
                'nullable',
                'string',
                'max:100',
            ],

            'is_active' => [
                'boolean',
            ],

            'variants' => [
                'required',
                'array',
                'min:1',
            ],

            'variants.*.id' => [
                'nullable',
                'integer',
                'exists:product_variants,id',
            ],

            'variants.*.color' => [
                'nullable',
                'string',
                'max:100',
            ],

            'variants.*.size' => [
                'nullable',
                'string',
                'max:100',
            ],

            'variants.*.purchase_price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'variants.*.selling_price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'variants.*.is_active' => [
                'boolean',
            ],

            'variants.*.image' => [
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Supplier wajib dipilih.',
            'supplier_id.exists' => 'Supplier yang dipilih tidak ditemukan.',

            'sku.required' => 'SKU produk wajib diisi.',
            'sku.unique' => 'SKU produk sudah digunakan.',

            'name.required' => 'Nama produk wajib diisi.',

            'variants.required' => 'Minimal harus ada 1 variasi produk.',
            'variants.min' => 'Minimal harus ada 1 variasi produk.',

            'variants.*.purchase_price.required' => 'HPP wajib diisi.',
            'variants.*.purchase_price.numeric' => 'HPP harus berupa angka.',

            'variants.*.selling_price.required' => 'Harga jual wajib diisi.',
            'variants.*.selling_price.numeric' => 'Harga jual harus berupa angka.',

            'variants.*.image.image' => 'File gambar tidak valid.',
            'variants.*.image.mimes' => 'Gambar harus JPG, JPEG, PNG, atau WEBP.',
            'variants.*.image.max' => 'Ukuran gambar maksimal 5 MB.',
        ];
    }
}
