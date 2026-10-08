import { useLayoutEffect } from 'react';

// Applies one page's original CSS file while that page is on screen, and
// removes it when you leave. This keeps index.css, signin.css and signup.css
// from overriding each other (they all style <body> and share class names).
export default function usePage(css, title) {
  useLayoutEffect(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const previousTitle = document.title;
    if (title) document.title = title;

    return () => {
      style.remove();
      document.title = previousTitle;
    };
  }, [css, title]);
}
