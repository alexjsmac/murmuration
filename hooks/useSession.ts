"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase-config";

/**
 * Returns a stable per-browser sessionId via Firebase Anonymous Auth.
 *
 * Why anon auth instead of a localStorage UUID: the RTDB security rules
 * gate writes to /wireframes/$sessionId, /glitchers/$sessionId, and
 * /connections/$sessionId on `auth.uid == $sessionId`. Without a real
 * Firebase auth identity, rules can't enforce ownership and any
 * devtools-savvy attendee could write to other users' nodes. Anon auth
 * is invisible to the user (no sign-in UI) — Firebase issues a stable
 * UID on first connect and caches it in IndexedDB across reloads.
 */
export function useSession(): string | null {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        // No cached session — issue a new anonymous UID.
        signInAnonymously(auth!).catch((err) => {
          console.error("Anonymous auth failed:", err);
        });
      }
    });
    return () => unsub();
  }, []);

  return uid;
}
