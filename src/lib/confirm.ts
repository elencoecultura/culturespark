import { toast } from "sonner";

/**
 * Confirmação on-brand (via toast) para ações destrutivas — substitui o
 * confirm() nativo do navegador, mantendo a estética do app.
 * Uso: confirmAction("Remover isto?", () => del.mutate(id))
 */
export function confirmAction(
  message: string,
  onConfirm: () => void,
  opts?: { confirmLabel?: string; cancelLabel?: string },
) {
  toast(message, {
    duration: 10000,
    action: { label: opts?.confirmLabel ?? "Confirmar", onClick: onConfirm },
    cancel: { label: opts?.cancelLabel ?? "Cancelar", onClick: () => {} },
  });
}
