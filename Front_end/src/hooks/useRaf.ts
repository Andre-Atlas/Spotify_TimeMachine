import { useEffect, useRef } from 'react'

/**
 * Loop de animação compartilhado. Sem a cena 3D não existe mais o
 * `useFrame` do R3F, e cada componente abrir o próprio rAF significaria
 * vários loops concorrendo. Este hook entrega dt em segundos, já limitado
 * para o caso de a aba voltar do background com um salto enorme.
 */
export function useRaf(cb: (dt: number, now: number) => void, active = true): void {
  const ref = useRef(cb)
  ref.current = cb

  useEffect(() => {
    if (!active) return
    let id = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 15)
      last = now
      ref.current(dt, now)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [active])
}
