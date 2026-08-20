import { useCallback, useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

/** Read a File or an image URL into an HTMLImageElement so it can be cropped. */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = source instanceof File ? URL.createObjectURL(source) : source
    const img = new Image()
    img.onload = () => {
      if (source instanceof File) URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => { reject(e) }
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas vacío"))), "image/jpeg", 0.9)
  })
}

/**
 * Dialoga de recorte de portada: muestra la imagen con un rectángulo que se
 * arrastra para elegir qué parte se usa, con zoom. Acepta un archivo nuevo O la
 * URL de la portada actual (para recortarla en el lugar sin volver a subirla).
 * Al confirmar produce la imagen recortada y la entrega como File para subirla.
 */
export function CoverCropDialog({
  open,
  source,
  onCancel,
  onConfirm,
}: {
  open: boolean
  /** New uploaded file, or the URL of the currently stored cover. */
  source: File | string | null
  onCancel: () => void
  onConfirm: (cropped: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const sourceRef = useRef<File | string | null>(null)
  if (source !== sourceRef.current) {
    // Reset the crop when a different image is opened.
    sourceRef.current = source
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    imageRef.current = null
  }

  // The first argument is the crop area as percentages (0-100), which we use to
  // map onto the image's natural pixels.
  const onCropComplete = useCallback((percentCrop: Area) => setCroppedArea(percentCrop), [])

  function onOpenChange(next: boolean) {
    if (!next) { sourceRef.current = null; onCancel() }
  }

  async function accept() {
    if (!source || !croppedArea) return
    setBusy(true)
    try {
      const image = imageRef.current ?? (await loadImage(source))
      imageRef.current = image
      const blob = await cropImage(image, croppedArea)
      const base = source instanceof File ? source.name.replace(/\.[^.]+$/, "") : "cover"
      onConfirm(new File([blob], `${base}.jpg`, { type: "image/jpeg" }))
    } catch {
      // fall back to the original if cropping failed (only meaningful for a File)
      if (source instanceof File) onConfirm(source)
    } finally {
      setBusy(false)
    }
  }

  const cropperImage =
    source == null
      ? undefined
      : source instanceof File
        ? URL.createObjectURL(source)
        : source

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
          {cropperImage && (
            <Cropper
              image={cropperImage}
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
            disabled={busy || !source}
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
