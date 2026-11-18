// Lado do navegador da trava de presença (login e check-in). O navegador
// guarda a permissão de localização depois do primeiro "Permitir", então a
// pergunta só aparece uma vez por aparelho/navegador.

export type GeoPoint = { lat: number; lng: number; accuracy: number };

export class GeoError extends Error {
  constructor(public title: string, description: string) {
    super(description);
  }
}

const HOW_TO_ALLOW =
  "No iPhone: Ajustes → Privacidade e Segurança → Serviços de Localização → Safari → \"Durante o Uso\". " +
  "No Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Depois tente de novo.";

export async function getCurrentGeo(): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new GeoError("Localização indisponível", "Este navegador não informa localização. Use o Wi-Fi da unidade.");
  }
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (status?.state === "denied") throw new GeoError("Localização bloqueada", HOW_TO_ALLOW);
  } catch (e) {
    if (e instanceof GeoError) throw e;
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new GeoError("Localização bloqueada", HOW_TO_ALLOW));
        else
          reject(
            new GeoError(
              "Não achamos sua localização",
              "Confira se a localização (GPS) do celular está ligada e tente de novo, de preferência perto de uma janela.",
            ),
          );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

type Blocked = {
  reason: string;
  nearest?: { name: string; distance: number } | null;
  accuracy?: number;
};

export function describePresenceBlock(r: Blocked, what: "entrar" | "fazer o check-in", ip?: string) {
  if (r.reason === "geo_imprecise") {
    return {
      title: "Localização imprecisa",
      description: `Sua localização veio com margem de ${Math.round(r.accuracy ?? 0)} m. Ligue o GPS e o Wi-Fi do celular e tente de novo.`,
    };
  }
  if (r.reason === "geo_outside") {
    const where = r.nearest ? ` Você está a ${formatDistance(r.nearest.distance)} de ${r.nearest.name}.` : "";
    return {
      title: "Você está fora da unidade",
      description: `Pra ${what}, é preciso estar numa unidade da Hector.${where}`,
    };
  }
  return {
    title: "Rede não autorizada",
    description: `Este Wi-Fi (${ip || "IP desconhecido"}) não está liberado. Conecte-se ao Wi-Fi do parque.`,
  };
}
