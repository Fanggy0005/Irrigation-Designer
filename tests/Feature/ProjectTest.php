<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_sent_to_login()
    {
        $this->get('/projects')->assertRedirect('/login');
    }

    public function test_users_see_only_their_own_projects()
    {
        $user = User::factory()->create();
        Project::factory()->for($user)->create(['name' => 'Mine']);
        Project::factory()->create(['name' => 'Someone else']);

        $this->actingAs($user)->get('/projects')->assertInertia(fn (Assert $page) => $page
            ->component('projects/index')
            ->has('projects', 1)
            ->where('projects.0.name', 'Mine'));
    }

    public function test_creating_a_project_opens_it_in_the_editor()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/projects', ['name' => 'Durian farm']);

        $project = $user->projects()->sole();
        $response->assertRedirect("/projects/{$project->id}/edit");
        $this->assertSame('Durian farm', $project->name);
        $this->assertNull($project->design);
    }

    public function test_a_project_needs_a_name()
    {
        $this->actingAs(User::factory()->create())
            ->post('/projects', ['name' => ''])
            ->assertSessionHasErrors('name');
    }

    public function test_the_editor_receives_the_project()
    {
        $project = Project::factory()->create(['design' => ['version' => 1, 'boundary' => []]]);

        $this->actingAs($project->user)->get("/projects/{$project->id}/edit")
            ->assertInertia(fn (Assert $page) => $page
                ->component('projects/editor')
                ->where('project.id', $project->id)
                ->where('project.design.version', 1));
    }

    public function test_autosave_stores_the_design_and_name()
    {
        $project = Project::factory()->create();
        $design = ['version' => 1, 'boundary' => [['lat' => 14.1, 'lng' => 101.2]]];

        $this->actingAs($project->user)
            ->putJson("/projects/{$project->id}", ['name' => 'Renamed', 'design' => $design])
            ->assertNoContent();

        $project->refresh();
        $this->assertSame('Renamed', $project->name);
        $this->assertSame($design, $project->design);
    }

    public function test_autosave_rejects_a_design_that_is_not_an_object()
    {
        $project = Project::factory()->create();

        $this->actingAs($project->user)
            ->putJson("/projects/{$project->id}", ['design' => 'broken'])
            ->assertUnprocessable();
    }

    public function test_users_cannot_open_change_or_delete_someone_elses_project()
    {
        $project = Project::factory()->create();
        $this->actingAs(User::factory()->create());

        $this->get("/projects/{$project->id}/edit")->assertForbidden();
        $this->putJson("/projects/{$project->id}", ['name' => 'Taken'])->assertForbidden();
        $this->delete("/projects/{$project->id}")->assertForbidden();

        $this->assertModelExists($project);
        $this->assertNotSame('Taken', $project->refresh()->name);
    }

    public function test_users_can_delete_their_project()
    {
        $project = Project::factory()->create();

        $this->actingAs($project->user)->delete("/projects/{$project->id}")->assertRedirect('/projects');

        $this->assertModelMissing($project);
    }
}
