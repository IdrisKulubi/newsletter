"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NewsletterService } from "@/lib/services/newsletter";
import { getCurrentUser } from "@/lib/auth";

export async function deleteNewsletter(id: string) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Authentication required");
    }

    // Delete newsletter
    await NewsletterService.delete(id);

    // Revalidate and redirect
    revalidatePath("/dashboard/newsletters");
    redirect("/dashboard/newsletters");
  } catch (error) {
    console.error("Failed to delete newsletter:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete newsletter"
    );
  }
}

export async function duplicateNewsletter(id: string, title?: string) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Authentication required");
    }

    // Duplicate newsletter
    const newsletter = await NewsletterService.duplicate(id, title);

    // Revalidate and redirect
    revalidatePath("/dashboard/newsletters");
    redirect(`/dashboard/newsletters/${newsletter.id}/edit`);
  } catch (error) {
    console.error("Failed to duplicate newsletter:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to duplicate newsletter"
    );
  }
}
