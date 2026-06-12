/**
 * Sets a cookie with the specified name, value, and optional expiration period.
 *
 * @param {string} name - The name of the cookie to set.
 * @param {string} value - The value to store in the cookie.
 * @param {number} [daysToExpire] - Optional number of days until the cookie expires. If not provided, the cookie will be a session cookie.
 */
export const setCookie = (name: string, value: string, daysToExpire?: number): void => {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (daysToExpire) {
    const date = new Date();
    date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
    cookie += `; expires=${date.toUTCString()}`;
  } else {
    cookie += '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }

  cookie += '; path=/';
  document.cookie = cookie;
};

/**
 * Retrieves the value of a specified cookie.
 *
 * @param {string} name - The name of the cookie to retrieve.
 * @returns {string | null} - The value of the cookie if found, otherwise null.
 */
export const getCookie = (name: string): string | null => {
  const cookieName = `${name}=`;
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(cookieName)) {
      return decodeURIComponent(cookie.substring(cookieName.length));
    }
  }

  return null;
};

/**
 * Deletes a cookie by setting its expiration date to a past date.
 *
 * @param {string} name - The name of the cookie to be deleted.
 */
export const deleteCookie = (name: string): void => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};