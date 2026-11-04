import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import {
  loadAvatarImage,
  releaseAvatarImage,
  renderAvatarCrop,
  type AvatarCropSource,
} from './avatar-image'

const VIEWPORT_SIZE = 280
const MIN_ZOOM = 1
const MAX_ZOOM = 5

export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [source, setSource] = useState<AvatarCropSource | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [zoom, setZoom] = useState(1),
    [viewportSize, setViewportSize] = useState(VIEWPORT_SIZE),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [saving, setSaving] = useState(false)
  const cancelButton = useRef<HTMLButtonElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    sourceRef = useRef<AvatarCropSource | null>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    drag = useRef<{
      pointerId: number
      startX: number
      startY: number
      offsetX: number
      offsetY: number
    } | null>(null),
    pinch = useRef<{
      distance: number
      zoom: number
      midpointX: number
      midpointY: number
      offsetX: number
      offsetY: number
    } | null>(null)

  useEffect(() => {
    let active = true
    void Promise.resolve()
      .then(() => loadAvatarImage(file))
      .then((next) => {
        if (!active) {
          releaseAvatarImage(next)
          return
        }
        sourceRef.current = next
        setSource(next)
        setLoading(false)
      })
      .catch((reason) => {
        if (!active) return
        setLoading(false)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Chưa thể mở ảnh đại diện. Vui lòng chọn ảnh khác.',
        )
      })
    return () => {
      active = false
      if (sourceRef.current) {
        releaseAvatarImage(sourceRef.current)
        sourceRef.current = null
      }
    }
  }, [file])

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  useEffect(() => {
    if (!source) return
    const element = workspace.current
    if (!element) return
    const measure = () => {
      const nextSize = Math.round(element.getBoundingClientRect().width)
      if (!nextSize) return
      setViewportSize(nextSize)
      setOffset((current) =>
        clampOffset(source, zoom, current.x, current.y, nextSize),
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [source, zoom])

  function closeOnEscape(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (pointers.current.size === 1) {
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      }
    } else if (pointers.current.size === 2) {
      drag.current = null
      const [first, second] = [...pointers.current.values()]
      pinch.current = {
        distance: distance(first, second),
        zoom,
        midpointX: (first.x + second.x) / 2,
        midpointY: (first.y + second.y) / 2,
        offsetX: offset.x,
        offsetY: offset.y,
      }
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (pointers.current.size >= 2 && pinch.current) {
      const [first, second] = [...pointers.current.values()],
        nextDistance = distance(first, second),
        nextMidpointX = (first.x + second.x) / 2,
        nextMidpointY = (first.y + second.y) / 2,
        nextZoom = clamp(
          pinch.current.zoom * (nextDistance / pinch.current.distance),
          MIN_ZOOM,
          MAX_ZOOM,
        )
      setZoom(nextZoom)
      setOffset(
        clampOffset(
          source,
          nextZoom,
          pinch.current.offsetX + nextMidpointX - pinch.current.midpointX,
          pinch.current.offsetY + nextMidpointY - pinch.current.midpointY,
          viewportSize,
        ),
      )
      return
    }
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    setOffset(
      clampOffset(
        source,
        zoom,
        drag.current.offsetX + event.clientX - drag.current.startX,
        drag.current.offsetY + event.clientY - drag.current.startY,
        viewportSize,
      ),
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  async function confirm() {
    if (!source || saving) return
    setSaving(true)
    try {
      const blob = await renderAvatarCrop(source, {
        offsetX: offset.x,
        offsetY: offset.y,
        zoom,
        viewportSize,
      })
      onConfirm(blob)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Chưa thể chuẩn hóa ảnh này. Vui lòng thử lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  const imageStyle = source
    ? imageLayout(source, zoom, offset, viewportSize)
    : undefined

  return (
    <div className="avatar-crop-backdrop">
      <section
        className="avatar-crop-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        aria-describedby="avatar-crop-help"
        onKeyDown={closeOnEscape}
      >
        <div className="avatar-crop-heading">
          <div>
            <p className="personal-group-label">Ảnh đại diện</p>
            <h2 id="avatar-crop-title">Chỉnh ảnh đại diện</h2>
          </div>
          <button
            ref={cancelButton}
            type="button"
            className="avatar-crop-close"
            onClick={onCancel}
            aria-label="Hủy chỉnh ảnh đại diện"
          >
            ×
          </button>
        </div>
        <p id="avatar-crop-help" className="avatar-crop-help">
          Kéo ảnh để chọn phần bạn muốn giữ. Bạn có thể phóng to bằng thanh
          trượt.
        </p>
        {loading && <p role="status">Đang mở ảnh…</p>}
        {error && <p role="alert">{error}</p>}
        {source && !error && (
          <>
            <div
              ref={workspace}
              className="avatar-crop-workspace"
              data-testid="avatar-crop-workspace"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={source.sourceUrl}
                alt="Ảnh đang chỉnh"
                draggable="false"
                style={imageStyle}
              />
              <span
                className="avatar-crop-guide"
                aria-hidden="true"
                style={{ inset: 0 }}
              />
            </div>
            <label className="avatar-crop-zoom">
              Thu phóng ảnh
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                aria-label="Thu phóng ảnh"
                onChange={(event) => {
                  const nextZoom = Number(event.currentTarget.value)
                  setZoom(nextZoom)
                  setOffset(
                    clampOffset(
                      source,
                      nextZoom,
                      offset.x,
                      offset.y,
                      viewportSize,
                    ),
                  )
                }}
              />
            </label>
          </>
        )}
        <div className="avatar-crop-actions">
          <button type="button" onClick={onCancel}>
            Hủy
          </button>
          <button type="button" disabled={!source || saving} onClick={confirm}>
            {saving ? 'Đang chuẩn bị…' : 'Dùng ảnh này'}
          </button>
        </div>
      </section>
    </div>
  )
}

function imageLayout(
  source: AvatarCropSource,
  zoom: number,
  offset: { x: number; y: number },
  viewportSize: number,
) {
  const scale =
    Math.max(
      viewportSize / source.image.naturalWidth,
      viewportSize / source.image.naturalHeight,
    ) * zoom
  return {
    width: source.image.naturalWidth * scale,
    height: source.image.naturalHeight * scale,
    left: `calc(50% + ${offset.x}px)`,
    top: `calc(50% + ${offset.y}px)`,
  }
}

function clampOffset(
  source: AvatarCropSource | null,
  zoom: number,
  x: number,
  y: number,
  viewportSize: number,
) {
  if (!source) return { x, y }
  const scale =
      Math.max(
        viewportSize / source.image.naturalWidth,
        viewportSize / source.image.naturalHeight,
      ) * zoom,
    maxX = Math.max(0, (source.image.naturalWidth * scale - viewportSize) / 2),
    maxY = Math.max(0, (source.image.naturalHeight * scale - viewportSize) / 2)
  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
  }
}

function distance(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  return Math.max(
    1,
    Math.hypot(second.x - first.x, second.y - first.y),
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
