import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    const script = existing || Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    script.addEventListener("load", resolve);
    script.addEventListener("error", reject);
    if (!existing) document.head.appendChild(script);
  });
}

// Renders Google's sign-in button; hidden entirely when no client ID is configured.
export function GoogleButton({ onCredential, onError }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (response) => onCredential(response.credential) });
        window.google.accounts.id.renderButton(ref.current, { theme: "filled_black", size: "large", width: ref.current.offsetWidth || 360, text: "continue_with" });
      })
      .catch(() => onError?.("Could not load Google sign-in"));
    return () => {
      cancelled = true;
    };
  }, [onCredential, onError]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex w-full justify-center" />;
}
