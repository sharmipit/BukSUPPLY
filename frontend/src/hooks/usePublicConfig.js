import { useEffect, useState } from 'react';
import api from '../api/client';

// Fallback configuration if public config endpoint is unreachable
const FALLBACK = {
  loaded: true,
  googleEnabled: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  recaptchaEnabled: !!import.meta.env.VITE_RECAPTCHA_SITE_KEY,
  recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY || '',
};

const EMPTY = {
  loaded: false,
  googleEnabled: false,
  googleClientId: '',
  recaptchaEnabled: false,
  recaptchaSiteKey: '',
};

export default function usePublicConfig() {
  const [config, setConfig] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    api
      .get('/public-config')
      .then(({ data }) => active && setConfig({ ...data, loaded: true }))
      .catch(() => active && setConfig(FALLBACK));
    return () => {
      active = false;
    };
  }, []);

  return config;
}
