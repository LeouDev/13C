"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Counts one store/vehicle view per browser per day (anonymous id kept in localStorage). */
export function ViewTracker({ businessId, vehicleId }: { businessId: string; vehicleId?: string }) {
  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem("13c_vid");
      if (!id) { id = crypto.randomUUID(); localStorage.setItem("13c_vid", id); }
    } catch {
      id = crypto.randomUUID();
    }
    createClient().rpc("track_view", { p_business_id: businessId, p_vehicle_id: (vehicleId ?? null) as string, p_viewer_hash: id }).then(() => {});
  }, [businessId, vehicleId]);
  return null;
}
