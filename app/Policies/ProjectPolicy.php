<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

/**
 * The app is free and every logged-in user gets every feature, so the only rule is
 * that a project belongs to the user who created it.
 */
class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        return $project->user_id === $user->id;
    }

    public function update(User $user, Project $project): bool
    {
        return $project->user_id === $user->id;
    }

    public function delete(User $user, Project $project): bool
    {
        return $project->user_id === $user->id;
    }
}
