import { createFileRoute } from "@tanstack/react-router";
import LinkCulturaApp from "@/components/link-cultura/LinkCulturaApp";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Encantômetro · Hector Studios" },
      {
        name: "description",
        content:
          "App de cultura e engajamento da Hector Studios: check-in, jornada, toques e visão do líder.",
      },
    ],
  }),
  component: LinkCulturaApp,
});
