export const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
       <rect width="100" height="100" fill="#d9d2c5"/>
       <circle cx="50" cy="38" r="18" fill="#8a7f6d"/>
       <path d="M16 92c4-22 20-32 34-32s30 10 34 32z" fill="#8a7f6d"/>
     </svg>`
  );

export const getAvatar = (user) => {
  const url =
    user?.avatar || user?.picture || user?.photoURL || user?.photo || user?.imageUrl;
  if (!url) return DEFAULT_AVATAR;

  // Google serves a small size by default; ask for a sharper one
  return url.includes("googleusercontent.com")
    ? url.replace(/=s\d+(-c)?$/, "=s256-c")
    : url;
};