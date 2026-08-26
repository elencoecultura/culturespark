import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarCheck } from "lucide-react";
import { getCheckinsByHouse } from "@/lib/checkins-dashboard.functions";

function dayLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function cellColor(pct: number) {
  if (pct >= 80) return "bg-emerald-400/25 text-emerald-200";
  if (pct >= 50) return "bg-amber-400/20 text-amber-200";
  if (pct > 0) return "bg-magic-red/20 text-red-200";
  return "bg-white/5 text-white/35";
}

export default function CheckinsDashboard() {
  const [days, setDays] = useState(14);
  const fn = useServerFn(getCheckinsByHouse);
  const q = useQuery({
    queryKey: ["checkins-by-house", days],
    queryFn: () => fn({ data: { days } }),
  });

  return (
    <div className="space-y-4">
      <div className="glass-soft rounded-[28px] p-5">
        <div className="flex items-center gap-2 text-white">
          <CalendarCheck className="h-5 w-5" />
          <h2 className="text-[17px] font-bold">Check-ins por casa</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
          Quantas pessoas fizeram o check-in de energia em cada dia, por atração. A cor mostra o
          % do time ativo daquela casa que checou: verde ≥80%, amarelo ≥50%, vermelho abaixo disso.
        </p>
        <div className="mt-3 flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                days === d ? "bg-white text-magic-purple" : "bg-white/10 text-white/75"
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center py-10 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {q.data && (
        <div className="glass-chip overflow-x-auto rounded-2xl p-3">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 whitespace-nowrap bg-[#241a4a] px-2 py-1.5 text-left font-semibold text-white/70">
                  Casa
                </th>
                {q.data.days.map((d) => (
                  <th key={d} className="whitespace-nowrap px-1.5 py-1.5 text-center font-medium text-white/55">
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.house}>
                  <td className="sticky left-0 whitespace-nowrap bg-[#241a4a] px-2 py-1.5 font-semibold text-white">
                    {r.house}
                    <span className="ml-1.5 font-normal text-white/45">({r.headcount})</span>
                  </td>
                  {r.byDay.map((count, i) => {
                    const pct = r.headcount ? Math.round((count / r.headcount) * 100) : 0;
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        <div className={`rounded-lg px-1.5 py-1.5 font-semibold ${cellColor(pct)}`}>{count}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
