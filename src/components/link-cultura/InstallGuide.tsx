import { Share, PlusSquare, MoreVertical, Smartphone } from "lucide-react";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 font-display text-[13px] font-black text-white">
        {n}
      </span>
      <div className="pt-0.5 text-[13.5px] leading-snug text-white/85">{children}</div>
    </li>
  );
}

export default function InstallGuide() {
  return (
    <>
      <div className="px-1 pt-1">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <Smartphone size={13} /> Instalação
        </div>
        <h1 className="mt-1.5 font-display text-[24px] font-black tracking-[-0.03em] text-white">
          Como instalar o app
        </h1>
        <p className="text-[12.5px] text-white/65">
          Instalar deixa o Por trás da Magia com ícone próprio na tela inicial, abrindo em tela cheia — sem
          precisar digitar o endereço toda vez.
        </p>
      </div>

      <div className="mt-5 glass-strong rounded-[26px] p-5">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-white">
          <Share size={16} /> No iPhone (Safari)
        </div>
        <ol className="space-y-3">
          <Step n={1}>
            Abra o app pelo <strong>Safari</strong> (precisa ser o Safari, não funciona pelo Instagram/WhatsApp).
          </Step>
          <Step n={2}>
            Toque no ícone de <strong>Compartilhar</strong> <Share size={13} className="inline -mt-0.5" /> na
            barra de baixo.
          </Step>
          <Step n={3}>
            Role e toque em <strong>"Adicionar à Tela de Início"</strong>{" "}
            <PlusSquare size={13} className="inline -mt-0.5" />.
          </Step>
          <Step n={4}>Toque em "Adicionar" no canto superior direito. Pronto!</Step>
        </ol>
      </div>

      <div className="mt-4 glass-strong rounded-[26px] p-5">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-white">
          <MoreVertical size={16} /> No Android (Chrome)
        </div>
        <ol className="space-y-3">
          <Step n={1}>
            Abra o app pelo <strong>Chrome</strong>. Geralmente aparece um banner "Instalar app" sozinho — é só
            tocar nele.
          </Step>
          <Step n={2}>
            Se não aparecer, toque nos <strong>3 pontinhos</strong> <MoreVertical size={13} className="inline -mt-0.5" />{" "}
            no canto superior direito.
          </Step>
          <Step n={3}>
            Toque em <strong>"Instalar app"</strong> (ou "Adicionar à tela inicial").
          </Step>
          <Step n={4}>Confirme tocando em "Instalar". Pronto!</Step>
        </ol>
      </div>

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-white/45">
        Dúvida ou não apareceu a opção? Chama no WhatsApp de suporte que a gente te ajuda.
      </p>
    </>
  );
}
