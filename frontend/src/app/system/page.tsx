"use client";

import { redirect } from "next/navigation";

export default function SystemHome() {
  // System entry: redirect to the Projects dashboard
  redirect("/system/projects");
}
