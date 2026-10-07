<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Kelola pengguna (khusus admin). */
class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->orderByRaw("role = 'admin' desc")->orderBy('name');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%"));
        }

        return response()->json($query->get(['id', 'name', 'email', 'role', 'is_active', 'created_at']));
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules(), $this->messages());

        $user = User::create($data + ['is_active' => true]);

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate($this->rules($user), $this->messages());

        $isSelf = $request->user()->is($user);
        $losesAdmin = $user->isAdmin()
            && (($data['role'] ?? $user->role) !== User::ROLE_ADMIN || ! ($data['is_active'] ?? $user->is_active));

        if ($isSelf && $losesAdmin) {
            throw ValidationException::withMessages([
                'role' => 'Anda tidak bisa menurunkan peran atau menonaktifkan akun sendiri.',
            ]);
        }

        if ($losesAdmin && $this->activeAdminCount() <= 1) {
            throw ValidationException::withMessages([
                'role' => 'Harus ada minimal 1 admin aktif.',
            ]);
        }

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $passwordChanged = isset($data['password']);
        $deactivated = $user->is_active && isset($data['is_active']) && ! $data['is_active'];

        $user->update($data);

        // Password diganti atau akun dinonaktifkan: keluarkan dari semua perangkat (kecuali sesi admin sendiri)
        if ($deactivated || ($passwordChanged && ! $isSelf)) {
            $user->tokens()->delete();
        }

        return response()->json($user->fresh());
    }

    public function destroy(Request $request, User $user)
    {
        if ($request->user()->is($user)) {
            return response()->json(['message' => 'Anda tidak bisa menghapus akun sendiri.'], 422);
        }

        if ($user->isAdmin() && $user->is_active && $this->activeAdminCount() <= 1) {
            return response()->json(['message' => 'Harus ada minimal 1 admin aktif.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Pengguna dihapus.']);
    }

    private function rules(?User $user = null): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8', 'max:100'],
            'role' => ['required', Rule::in(User::ROLES)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    private function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah dipakai pengguna lain.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal 8 karakter.',
            'role.in' => 'Peran tidak valid.',
        ];
    }

    private function activeAdminCount(): int
    {
        return User::where('role', User::ROLE_ADMIN)->where('is_active', true)->count();
    }
}
