export class HttpError extends Error {
    constructor(public readonly status: number) {
        super(`HTTP ${status}`);
    }
}

/** JSON PUT to a Laravel route, with the CSRF token Laravel keeps in the XSRF-TOKEN cookie. */
export async function putJson(url: string, body: unknown): Promise<void> {
    const response = await fetch(url, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new HttpError(response.status);
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}
