<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OperationalExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'qty' => ['nullable', 'numeric', 'min:0.01', 'max:99999999'],
            'unit' => ['nullable', 'string', 'max:30'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999999'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.required' => 'Tanggal wajib diisi.',
            'expense_date.date' => 'Tanggal tidak valid.',
            'category.required' => 'Kategori wajib diisi.',
            'name.required' => 'Nama biaya wajib diisi.',
            'qty.numeric' => 'Jumlah harus berupa angka.',
            'qty.min' => 'Jumlah harus lebih dari 0.',
            'amount.required' => 'Total harga wajib diisi.',
            'amount.numeric' => 'Total harga harus berupa angka.',
            'amount.min' => 'Total harga harus lebih dari 0.',
        ];
    }
}
