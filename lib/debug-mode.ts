"use client";
import { useEffect, useState } from "react";

const KEY = "reiri-debug-mode";
const EVENT = "reiri:debug-changed";

export function getDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setDebugMode(on: boolean): void {
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
}

export function useDebugMode(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(getDebugMode());
    const handler = () => setOn(getDebugMode());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return on;
}
