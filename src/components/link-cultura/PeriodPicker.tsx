import { useState } from "react";
import { CalendarRange } from "lucide-react";

export type PeriodPreset = "dia" | "mes" | "ano";
export type PeriodValue = { kind: "preset"; period: PeriodPreset } | { kind: "custom"; from: string; to: string };

const PRESET_LABEL: Record<PeriodPreset, string> = { dia: "Dia", mes: "Mês", ano: "Ano" };

function todaySP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Seletor de período usado em todos os painéis de indicadores: presets
// rápidos (Dia/Mês/Ano) + uma janela personalizada (de/até no calendário).
export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const [customFrom, setCustomFrom] = useState(value.kind === "custom" ? value.from : "");
  const [customTo, setCustomTo] = useState(value.kind === "custom" ? value.to : todaySP());
  const showCustom = value.kind === "custom";

  function applyCustom(from: string, to: string) {
    if (!from || !to) return;
    onChange({ kind: "custom", from: from <= to ? from : to, to: from <= to ? to : from });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {(["dia", "mes", "ano"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange({ kind: "preset", period: p })}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              value.kind === "preset" && value.period === p ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75"
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (!showCustom) applyCustom(customFrom || todaySP(), customTo || todaySP());
          }}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
            showCustom ? "bg-brand-grad text-white shadow-glow" : "glass-chip text-white/75"
          }`}
        >
          <CalendarRange size={13} /> Personalizado
        </button>
      </div>

      {showCustom && (
        <div className="glass-chip flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
          <label className="flex items-center gap-1.5 text-[11.5px] text-white/70">
            De
            <input
              type="date"
              value={customFrom}
              max={customTo || todaySP()}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                applyCustom(e.target.value, customTo);
              }}
              className="rounded-lg bg-white/10 px-2 py-1 text-[12px] text-white outline-none [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11.5px] text-white/70">
            Até
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todaySP()}
              onChange={(e) => {
                setCustomTo(e.target.value);
                applyCustom(customFrom, e.target.value);
              }}
              className="rounded-lg bg-white/10 px-2 py-1 text-[12px] text-white outline-none [color-scheme:dark]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
