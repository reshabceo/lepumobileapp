import * as React from "react"
import { Capacitor } from "@capacitor/core"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Native iOS/Android builds must always use the mobile layout.
  // iPad (and large phones) can report width >= 768 and incorrectly get the
  // desktop "phone frame" preview, which breaks post-login UX for App Review.
  const isNative = Capacitor.isNativePlatform()
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    isNative ? true : undefined
  )

  React.useEffect(() => {
    if (isNative) {
      setIsMobile(true)
      return
    }
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [isNative])

  return isNative || !!isMobile
}
