"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeStartRequest,
  sendStartRequest,
  type PendingStartRequest,
  type StartView,
  type StartOperation,
} from "@/lib/start/client";

export function useStartConversation(
  initialView: StartView = { kind: "input" },
  initialSessionId?: string,
) {
  const [view, setView] = useState<StartView>(initialView);
  const [sessionId, setSessionId] = useState<string | undefined>(
    initialSessionId,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    login?: boolean;
  } | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pending = useRef<PendingStartRequest | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = null;
    };
  }, []);
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(
      () => setWaitSeconds((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  async function execute(request: PendingStartRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await sendStartRequest(request);
      if (!alive.current) return;
      if (result.kind === "view") {
        pending.current = null;
        setCanRetry(false);
        setWaitSeconds(0);
        setView(result.view);
        if (result.sessionId) setSessionId(result.sessionId);
      } else {
        setNotice(result);
        setCanRetry(result.retryable);
        setWaitSeconds(result.retryAfter ?? 0);
        if (!result.retryable) pending.current = null;
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function submit(operation: StartOperation, body: Record<string, unknown>) {
    if (inFlight.current || pending.current) return;
    const request = makeStartRequest(operation, body);
    pending.current = request;
    void execute(request);
  }
  function retry() {
    if (!inFlight.current && waitSeconds === 0 && pending.current)
      void execute(pending.current);
  }
  function reset() {
    if (inFlight.current || pending.current) return;
    setView({ kind: "input" });
    setSessionId(undefined);
    setNotice(null);
    setCanRetry(false);
    setWaitSeconds(0);
  }
  return {
    view,
    sessionId,
    busy,
    notice,
    canRetry,
    waitSeconds,
    locked: busy || canRetry,
    submit,
    retry,
    reset,
  };
}
