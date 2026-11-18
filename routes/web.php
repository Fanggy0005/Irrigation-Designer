<?php

use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    // Login and the starter-kit links still point at "dashboard"; the project list is the home.
    Route::redirect('dashboard', '/projects')->name('dashboard');

    Route::resource('projects', ProjectController::class)->only(['index', 'store', 'edit', 'update', 'destroy']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
