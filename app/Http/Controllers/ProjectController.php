<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('projects/index', [
            'projects' => $request->user()->projects()
                ->latest('updated_at')
                ->get(['id', 'name', 'updated_at']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $project = $request->user()->projects()->create($validated);

        return to_route('projects.edit', $project);
    }

    public function edit(Project $project): Response
    {
        Gate::authorize('update', $project);

        return Inertia::render('projects/editor', [
            'project' => $project->only(['id', 'name', 'design']),
        ]);
    }

    /** Printable report of the saved design; the editor opens it once its last edits are saved. */
    public function report(Project $project): Response
    {
        Gate::authorize('view', $project);

        return Inertia::render('projects/report', [
            'project' => $project->only(['id', 'name', 'design', 'updated_at']),
        ]);
    }

    /** Called by the editor's autosave with JSON; the design's shape is checked client-side. */
    public function update(Request $request, Project $project): HttpResponse
    {
        Gate::authorize('update', $project);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'design' => ['sometimes', 'array'],
        ]);

        $project->update($validated);

        return response()->noContent();
    }

    public function destroy(Project $project): RedirectResponse
    {
        Gate::authorize('delete', $project);

        $project->delete();

        return to_route('projects.index');
    }
}
