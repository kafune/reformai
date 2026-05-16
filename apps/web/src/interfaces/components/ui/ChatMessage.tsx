import { cn } from "@/shared/cn"
import { Avatar } from "./Avatar"
import { Icon } from "./Icon"

/** Mensagem da IA — bolha clara, selo "IA · assistiva", disclaimer opcional. */
export function AIMessage({
  children,
  disclaimer,
  className,
}: {
  children: React.ReactNode
  disclaimer?: string
  className?: string
}) {
  return (
    <div className={cn("flex max-w-[85%] gap-3", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-green-900">
        <Icon name="sparkle" size={16} className="text-green-300" />
      </div>
      <div className="flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-700">
            Assistente ReformAI
          </span>
          <span className="rounded-xs bg-green-100 px-1.5 py-0.5 font-mono text-[10px] text-green-800">
            IA · assistiva
          </span>
        </div>
        <div className="rounded-[2px_12px_12px_12px] bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-700 shadow-hair">
          {children}
        </div>
        {disclaimer && (
          <div className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-ink-400" />
            <span>{disclaimer}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Mensagem do usuário — bolha verde escura, alinhada à direita. */
export function UserMessage({
  children,
  name = "Você",
  className,
}: {
  children: React.ReactNode
  name?: string
  className?: string
}) {
  return (
    <div className={cn("flex max-w-[75%] flex-row-reverse gap-3 self-end", className)}>
      <Avatar name={name} color="var(--rai-clay-500)" size={32} />
      <div className="rounded-[12px_2px_12px_12px] bg-green-800 px-4 py-3 text-sm leading-normal text-bone-50">
        {children}
      </div>
    </div>
  )
}
