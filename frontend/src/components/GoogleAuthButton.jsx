import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

// Google's real button is an iframe that cannot be styled, so we draw our own brown
// button and put the real (invisible) Google button exactly on top of it.

const GOOGLE_HEIGHT = 40;
const MIN_W = 200;
const MAX_W = 400;

export default function GoogleAuthButton({
  clientId,
  text = 'continue_with', 
  label = 'Continue with Google',
  onCredential,
  onError,
}) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 320, scale: 1.15 });

  const credentialRef = useRef(onCredential);
  const errorRef = useRef(onError);
  credentialRef.current = onCredential;
  errorRef.current = onError;
  const handleSuccess = useCallback((res) => credentialRef.current?.(res.credential), []);
  const handleError = useCallback(() => errorRef.current?.(), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const measure = () => {
      const scale = el.clientHeight / GOOGLE_HEIGHT || 1;
      const width = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(el.clientWidth / scale)));
      setSize((prev) =>
        prev.width === width && prev.scale === scale ? prev : { width, scale }
      );
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div className="google-sso-wrapper" ref={wrapRef}>
      <button type="button" className="sso-google-btn" tabIndex={-1} aria-hidden="true">
        <i className="bi bi-google"></i> {label}
      </button>

      <div className="google-overlay">
        <div
          style={{
            width: size.width,
            transform: `scale(${size.scale})`,
            transformOrigin: 'top left',
          }}
        >
          <GoogleOAuthProvider clientId={clientId}>
            <GoogleLogin
              theme="outline"
              size="large"
              shape="pill"
              width={String(size.width)}
              text={text}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </GoogleOAuthProvider>
        </div>
      </div>
    </div>
  );
}