import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A password `Input` with a show/hide toggle. */
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)
    return (
      <div className="relative">
        <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} ref={ref} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-0 top-0 h-full px-3 flex items-center text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
