const ID = '[1-9]\\d{0,9}'

export const ALLOWED_ROUTES: readonly RegExp[] = [
  /^stations$/,
  new RegExp(`^stations/${ID}/current$`),
  new RegExp(`^stations/${ID}/forecast$`),
]

export function isAllowedPath(path: string): boolean {
  return ALLOWED_ROUTES.some((route) => route.test(path))
}
