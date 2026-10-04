/** Ruta pública de un asset (respeta la base de Vite). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
