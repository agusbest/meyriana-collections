<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Akun yang dinonaktifkan langsung keluar, walau token lamanya masih ada. */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => 'Akun Anda dinonaktifkan. Hubungi admin.'], 401);
        }

        return $next($request);
    }
}
