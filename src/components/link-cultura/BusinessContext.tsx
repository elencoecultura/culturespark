import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  /** "" = todos os negócios (apenas para admin/direção). String = negócio específico. */
  business: string;
  setBusiness: (b: string) => void;
  /** Se o usuário pode trocar de negócio livremente. */
  canSelect: boolean;
};

const BusinessCtx = createContext<Ctx>({ business: "", setBusiness: () => {}, canSelect: false });

const STORAGE_KEY = "hector.selected-business";

export function BusinessProvider({
  ownBusiness,
  canSelect,
  children,
}: {
  ownBusiness: string | null | undefined;
  canSelect: boolean;
  children: ReactNode;
}) {
  const initial = useMemo(() => {
    if (canSelect) {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return stored;
      }
      return ""; // todos por padrão
    }
    return ownBusiness ?? "";
  }, [canSelect, ownBusiness]);

  const [business, setBusinessState] = useState(initial);

  useEffect(() => {
    if (!canSelect) setBusinessState(ownBusiness ?? "");
  }, [canSelect, ownBusiness]);

  const setBusiness = (b: string) => {
    if (!canSelect) return;
    setBusinessState(b);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, b);
  };

  return (
    <BusinessCtx.Provider value={{ business, setBusiness, canSelect }}>{children}</BusinessCtx.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessCtx);
}
