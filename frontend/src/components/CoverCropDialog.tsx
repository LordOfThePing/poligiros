import { useCallback, useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

/** Read a File into an HTMLImageElement so it can be cropped. */
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

/** Crop `image` to the selected percentage area and resolve a Blob. */
async function cropImage(image: HTMLImageElement, crop: Area): Promise<Blob> {
  const canvas = document.createElement("canvas")
  const sx = (crop.x / 100) * image.naturalWidth
  const sy = (crop.y / 100) * image.naturalHeight
  const sw = (crop.width / 100) * image.naturalWidth
  const sh = (crop.height / 100) * image.naturalHeight
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas vacío"))), "image/png")
  })
}

/**
 * Dialoga de recorte de portada: muestra la imagen con un rectángulo que se
 * arrastra para elegir qué parte se usa, con zoom. Al confirmar produce la
 * imagen recortada y la entrega como File para subirla.
 */
export function CoverCropDialog({
  open,
  imageFile,
  onCancel,
  onConfirm,
}: {
  open: boolean
  imageFile: File | null
  onCancel: () => void
  onConfirm: (cropped: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  // The first argument is the crop area as percentages (0-100), which we use to
  // map onto the image's natural pixels.
  const onCropComplete = useCallback((percentCrop: Area) => setCroppedArea(percentCrop), [])

  function onOpenChange(next: boolean) {
    if (!next) { setCrop({ x: 0, y: 0 }); setZoom(1); setCroppedArea(null); onCancel() }
  }

  async function accept() {
    if (!imageFile || !croppedArea) return
    setBusy(true)
    try {
      const image = imageRef.current ?? (await fileToImage(imageFile))
      imageRef.current = image
      const blob = await cropImage(image, croppedArea)
      const name = imageFile.name.replace(/\.[^.]+$/, ".png")
      onConfirm(new File([blob], name, { type: "image/png" }))
    } catch {
      // fall back to the original if cropping failed
      onConfirm(imageFile)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Ajustá la portada</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Arrastrá el rectángulo y usá la rueda / el control de zoom para elegir cómo se ve la portada.
        </p>

        <div className="relative w-full h-64 bg-black/5 rounded-lg overflow-hidden">
          {imageFile && (
            <Cropper
              image={URL.createObjectURL(imageFile)}
              crop={crop}
              zoom={zoom}
              aspect={2 / 1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Zoom</Label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button
            className="bg-brand-accent hover:bg-brand-accent-dark"
            disabled={busy || !imageFile}
            onClick={accept}
          >
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Recortar y subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
