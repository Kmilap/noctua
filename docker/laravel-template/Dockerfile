# syntax=docker/dockerfile:1.6
# noctua/laravel-template:1.0
# Imagen demo de Laravel 11 sobre FrankenPHP (Caddy + PHP 8.3 con worker mode).

FROM dunglas/frankenphp:1-php8.3-alpine AS base

RUN install-php-extensions \
        pdo_sqlite \
        intl \
        opcache \
        pcntl \
        bcmath

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# La imagen base de FrankenPHP ya tiene archivos en /app.
# Instalamos Laravel en /tmp/laravel y luego movemos el contenido a /app
# limpiando lo que vino por defecto.
RUN composer create-project --prefer-dist laravel/laravel:^11.0 /tmp/laravel \
    && composer clear-cache \
    && rm -rf /app/* /app/.[!.]* 2>/dev/null || true \
    && cp -a /tmp/laravel/. /app/ \
    && rm -rf /tmp/laravel

WORKDIR /app

RUN touch database/database.sqlite \
    && sed -i 's|^DB_CONNECTION=.*|DB_CONNECTION=sqlite|' .env \
    && sed -i '/^DB_HOST=/d; /^DB_PORT=/d; /^DB_DATABASE=/d; /^DB_USERNAME=/d; /^DB_PASSWORD=/d' .env

RUN php artisan key:generate --force

RUN chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache

COPY Caddyfile /etc/caddy/Caddyfile

ENV SERVER_NAME=:8000
ENV APP_ENV=production
ENV APP_DEBUG=false

EXPOSE 8000

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
