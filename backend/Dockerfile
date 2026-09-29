# ============================================
# Laravel API - Meyriana Collection (Render)
# ============================================
FROM php:8.3-apache

# 1. Paket sistem & ekstensi PHP
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip ca-certificates libzip-dev libicu-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql zip bcmath intl opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# 2. Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# 3. Konfigurasi Apache (port dinamis dari Render via $PORT)
ENV PORT=10000
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
RUN echo 'Listen ${PORT}' > /etc/apache2/ports.conf \
    && echo 'ServerName localhost' >> /etc/apache2/apache2.conf

# 4. Konfigurasi PHP production
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

WORKDIR /var/www/html

# 5. Install dependency dulu (supaya layer ini di-cache)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# 6. Copy seluruh kode aplikasi
COPY . .

# 7. Autoload, folder storage, & permission
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions \
        storage/framework/views bootstrap/cache \
    && composer dump-autoload --optimize --no-dev \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# 8. Entrypoint (hapus CRLF dari Windows untuk jaga-jaga)
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
