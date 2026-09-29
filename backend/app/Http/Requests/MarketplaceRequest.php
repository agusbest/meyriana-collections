<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarketplaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    // Kode selalu huruf kecil supaya konsisten (dipakai untuk warna di dashboard)
    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge([
                'code' => strtolower(trim((string) $this->input('code'))),
            ]);
        }
    }

    public function rules(): array
    {
        $marketplace = $this->route('marketplace');
        $marketplaceId = is_object($marketplace) ? $marketplace->id : $marketplace;

        return [
            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'code' => [
                'required',
                'string',
                'max:100',
                'alpha_dash:ascii',
                Rule::unique('marketplaces', 'code')->ignore($marketplaceId),
            ],

            'is_active' => [
                'boolean',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama marketplace wajib diisi.',
            'code.required' => 'Kode marketplace wajib diisi.',
            'code.alpha_dash' => 'Kode hanya boleh huruf, angka, strip (-), dan garis bawah (_).',
            'code.unique' => 'Kode marketplace sudah digunakan.',
        ];
    }
}
