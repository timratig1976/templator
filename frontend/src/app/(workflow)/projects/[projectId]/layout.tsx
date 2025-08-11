"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = params?.projectId as string;

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        <Link href="/">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/projects">Projects</Link>
        <span className="mx-2">/</span>
        <span className="font-medium">{projectId}</span>
      </div>
      {children}
    </div>
  );
}
