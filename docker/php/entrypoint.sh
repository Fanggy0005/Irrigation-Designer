#!/bin/sh
# Prepares the app before starting the dev server. Other commands (e.g. `artisan tinker`)
# run directly, without these steps.
set -e
cd /var/www/html

if [ "$1" = "php" ] && [ "$2" = "artisan" ] && [ "$3" = "serve" ]; then
    if [ ! -f vendor/autoload.php ] || [ composer.lock -nt vendor/autoload.php ]; then
        echo "[app] Installing Composer dependencies..."
        composer install --no-interaction --prefer-dist
    fi

    if [ ! -f "$DB_DATABASE" ]; then
        echo "[app] Creating the SQLite database at $DB_DATABASE"
        touch "$DB_DATABASE"
    fi

    php artisan migrate --force

    # Seed only an empty database: the seeder creates test@example.com, which must be unique.
    users=$(php -r '$db = new PDO("sqlite:" . getenv("DB_DATABASE")); echo $db->query("select count(*) from users")->fetchColumn();')
    if [ "$users" = "0" ]; then
        echo "[app] Empty database, seeding..."
        php artisan db:seed --force
    fi
fi

exec "$@"
