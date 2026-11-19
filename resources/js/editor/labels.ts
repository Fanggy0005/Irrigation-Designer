import { type PipeKind } from '@/domain/project';

export const PIPE_KIND_LABELS: Record<PipeKind, string> = { main: 'ท่อเมน', submain: 'ท่อเมนย่อย', lateral: 'ท่อแขนง' };

/** "ท่อเมน 2": the kind and the pipe's number among pipes of that kind, in drawing order. */
export function pipeLabel(pipe: { id: string; kind: PipeKind }, pipes: readonly { id: string; kind: PipeKind }[]): string {
    const number = pipes.filter((p) => p.kind === pipe.kind).findIndex((p) => p.id === pipe.id) + 1;
    return `${PIPE_KIND_LABELS[pipe.kind]} ${number}`;
}

/** A zone's name, or "โซน n" when the designer cleared it. */
export function zoneLabel(zone: { name: string } | undefined, index: number): string {
    return zone?.name || `โซน ${index + 1}`;
}
