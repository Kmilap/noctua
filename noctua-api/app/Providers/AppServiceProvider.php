<?php

namespace App\Providers;

use App\Models\Invitation;
use App\Policies\InvitationPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::policy(Invitation::class, InvitationPolicy::class);
    }
}
