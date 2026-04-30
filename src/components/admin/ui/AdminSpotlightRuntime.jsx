"use client";

import { useEffect } from "react";

export default function AdminSpotlightRuntime() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(hover: none), (pointer: coarse)").matches
    ) {
      return;
    }

    let frame = null;
    let activeElement = null;

    const clearActive = () => {
      if (!activeElement) {
        return;
      }

      activeElement.classList.remove("is-spotlight-active");
      activeElement = null;
    };

    const handlePointerMove = (event) => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        const spotlightHost = event.target instanceof Element ? event.target.closest(".admin-spotlight") : null;

        if (!spotlightHost) {
          clearActive();
          return;
        }

        if (activeElement && activeElement !== spotlightHost) {
          activeElement.classList.remove("is-spotlight-active");
        }

        const rect = spotlightHost.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        spotlightHost.style.setProperty("--spotlight-x", `${x}px`);
        spotlightHost.style.setProperty("--spotlight-y", `${y}px`);
        spotlightHost.classList.add("is-spotlight-active");
        activeElement = spotlightHost;
      });
    };

    const handlePointerLeave = () => {
      clearActive();
    };

    const handlePointerDown = (event) => {
      const spotlightHost = event.target instanceof Element ? event.target.closest(".admin-spotlight") : null;
      if (!spotlightHost) {
        clearActive();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }

      clearActive();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("blur", handlePointerLeave);
    };
  }, []);

  return null;
}
