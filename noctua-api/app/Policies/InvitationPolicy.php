<?php

namespace App\Policies;

use App\Models\Invitation;
use App\Models\User;

class InvitationPolicy
{
    public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }
}
