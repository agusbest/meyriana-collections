<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Hanya admin yang boleh lewat (Dashboard, kelola pengguna). */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isAdmin()) {
            return response()->json(['message' => 'Halaman ini hanya untuk admin.'], 403);
        }

        return $next($request);
    }
}
