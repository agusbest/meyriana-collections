#!/bin/sh
set -e

echo "==> Caching konfigurasi..."
php artisan config:cache
php artisan route:cache
php artisan view:cache || true

echo "==> Menjalankan migrasi database..."
php artisan migrate --force

# Seeder hanya jalan kalau env RUN_SEEDER=true (set sekali saja di Render)
if [ "$RUN_SEEDER" = "true" ]; then
    echo "==> Menjalankan seeder..."
    php artisan db:seed --force
fi

php artisan storage:link || true

echo "==> Menjalankan Apache di port ${PORT}..."
exec apache2-foreground
