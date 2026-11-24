import { MutationCache, QueryClient } from "@tanstack/react-query";
import { isCheckinRequiredError } from "@/lib/checkin-rules";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Ação recusada por falta do check-in do dia: avisa o app, que leva a
  // pessoa pro check-in no topo da tela inicial.
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        if (typeof window !== "undefined" && isCheckinRequiredError(error)) {
          window.dispatchEvent(new CustomEvent("checkin-required"));
        }
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
