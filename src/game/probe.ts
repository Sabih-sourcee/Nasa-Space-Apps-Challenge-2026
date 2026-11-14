// Read-only handles that scenes publish for automated browser checks
// (for example the astronaut's position). Gameplay never reads from here.
export const probe: Record<string, unknown> = {};
