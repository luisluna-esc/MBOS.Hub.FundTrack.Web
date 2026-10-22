/** Forma del usuario con que se entra: nombre.apellido (minúsculas, sin tildes), con un número opcional. */
export const USERNAME_PATTERN = /^[a-z]+\.[a-z]+[0-9]*$/;

/** Una palabra en minúsculas, sin tildes ni eñes y solo con letras de la a a la z. */
function clean(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * Igual que Usernames.FromFullName del backend: nombre y primer apellido. Con 4 palabras o más se
 * toma la tercera (dos nombres y dos apellidos); con 2 o 3, la segunda.
 * "Juan Carlos Mamani Quispe" da juan.mamani; "María Quispe" da maria.quispe.
 */
export function usernameFromFullName(fullName: string): string {
  const words = fullName.split(/\s+/).map(clean).filter(Boolean);
  if (words.length < 2) {
    return words[0] ?? '';
  }
  return `${words[0]}.${words.length >= 4 ? words[2] : words[1]}`;
}
