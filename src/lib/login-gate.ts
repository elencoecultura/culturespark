import { enforceWifiLock } from "@/lib/wifi.functions";
import { describePresenceBlock, GeoError, getCurrentGeo } from "@/lib/geo-client";

// Trava de presença do login (e da redefinição de senha): tenta pelo Wi-Fi e,
// se o servidor pedir, manda a localização do celular. Só pede o GPS de quem
// precisa — quem está no Wi-Fi certo ou é liberado nem vê a pergunta.
export async function passLoginGate(): Promise<{ ok: true } | { ok: false; title: string; description: string }> {
  let check = await enforceWifiLock({ data: {} });
  if (!check.allowed && check.reason === "need_location") {
    try {
      const geo = await getCurrentGeo();
      check = await enforceWifiLock({ data: { geo } });
    } catch (e) {
      if (e instanceof GeoError) return { ok: false, title: e.title, description: e.message };
      throw e;
    }
  }
  if (check.allowed) return { ok: true };
  return { ok: false, ...describePresenceBlock(check, "entrar", check.ip) };
}
