import { useLayoutEffect } from 'react';

// Injects scoped page CSS on mount and cleans it up on unmount to prevent stylesheet conflicts
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
