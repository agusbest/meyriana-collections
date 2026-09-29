<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarketplaceFeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // store: marketplace dari URL (/marketplaces/{marketplace}/fees)
        // update: marketplace diambil dari fee yang diedit (/fees/{fee})
        $fee = $this->route('fee');
        $marketplace = $this->route('marketplace');

        $marketplaceId = is_object($marketplace)
            ? $marketplace->id
            : (is_object($fee) ? $fee->marketplace_id : null);

        $feeId = is_object($fee) ? $fee->id : null;

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                // nama biaya tidak boleh kembar di marketplace yang sama
                Rule::unique('marketplace_fees', 'name')
                    ->where('marketplace_id', $marketplaceId)
                    ->ignore($feeId),
            ],

            'type' => [
                'required',
                Rule::in(['percentage', 'fixed']),
            ],

            'value' => [
                'required',
                'numeric',
                'min:0',
                // persentase tidak boleh lebih dari 100
                Rule::when($this->input('type') === 'percentage', ['max:100']),
            ],

            'is_active' => [
                'boolean',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama biaya wajib diisi.',
            'name.unique' => 'Nama biaya sudah ada di marketplace ini.',
            'type.required' => 'Tipe biaya wajib dipilih.',
            'type.in' => 'Tipe biaya tidak valid.',
            'value.required' => 'Nilai biaya wajib diisi.',
            'value.numeric' => 'Nilai biaya harus berupa angka.',
            'value.min' => 'Nilai biaya tidak boleh kurang dari 0.',
            'value.max' => 'Persentase tidak boleh lebih dari 100.',
        ];
    }
}
