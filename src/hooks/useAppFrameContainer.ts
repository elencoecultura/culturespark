import { useEffect, useState } from "react";

// Elemento #app-frame (ver __root.tsx / styles.css) — a "moldura" visual do
// app em telas largas. Passe o resultado como `container` pro Sheet/Dialog
// portarem dentro da moldura em vez de flutuar soltos na janela inteira do
// navegador. Em celular de verdade isso não muda nada (a tela já é a
// moldura). Só existe no client (SSR não tem `document`), por isso o
// useEffect + useState em vez de calcular direto no render.
export function useAppFrameContainer(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById("app-frame"));
  }, []);
  return el;
}
