"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MINISTRY_COOKIE } from "@/lib/ministry";

/** Troca o setor ativo (guardado em cookie) e recarrega o shell. */
export async function setActiveMinistry(ministryId: string, churchSlug: string) {
  (await cookies()).set(MINISTRY_COOKIE, ministryId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath(`/${churchSlug}`, "layout");
}
