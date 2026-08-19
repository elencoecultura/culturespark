import { createFileRoute } from "@tanstack/react-router";
import LinkCulturaApp from "@/components/link-cultura/LinkCulturaApp";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Por trás da Magia · Hector Studios" },
      {
        name: "description",
        content:
          "App de cultura e engajamento da Hector Studios: check-in, jornada, elogios rápidos e visão do líder.",
      },
    ],
  }),
  component: LinkCulturaApp,
});
