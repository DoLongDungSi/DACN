// backend/utils/helpers.js

/**
 * Recursively converts object keys from snake_case or kebab-case to camelCase.
 * @param {any} obj - The object or array to convert.
 * @returns {any} - The object or array with camelCase keys.
 */
const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamelCase(v));
  } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    // Check if it's a plain object
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/([-_][a-z])/gi, ($1) =>
        $1.toUpperCase().replace('-', '').replace('_', '')
      );
      result[camelKey] = toCamelCase(obj[key]); // Recursively convert nested objects/arrays
      return result;
    }, {});
  }
  return obj; // Return primitives or non-plain objects as is
};

/**
 * Generates a consistent Tailwind background color class based on username.
 * @param {string | undefined} username - The username string.
 * @returns {string} - A Tailwind background color class (e.g., 'bg-purple-600').
 */
const getAvatarColor = (username) => {
  const colors = [
    'bg-purple-600',
    'bg-blue-600',
    'bg-green-600',
    'bg-yellow-600',
    'bg-red-600',
    'bg-indigo-600',
    'bg-pink-600',
    'bg-teal-600', // Added more colors
    'bg-orange-600',
  ];
  if (!username || typeof username !== 'string') return colors[0]; // Handle null/undefined/wrong type

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};


module.exports = {
  toCamelCase,
  getAvatarColor,
};
