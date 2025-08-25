"use client";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { MAINTENANCE_ICONS } from "./maintenanceIcons";
import DeadCodeIcon from "./icons/DeadCodeIcon";

export default function MaintenanceNav() {
  const pathname = usePathname();

  const inAI = (pathname || "").startsWith("/maintenance/ai");
  const inCore = (pathname || "").startsWith("/maintenance/core");
  const atRoot = (pathname || "") === "/maintenance";

  // Primary icons dynamic based on area:
  // - In AI area: [Home, Core]
  // - In Core area: [Home, AI]
  // - Elsewhere: [Home, AI]
  const primary = atRoot
    ? [
        { href: "/maintenance", icon: MAINTENANCE_ICONS.home, title: "Home" },
        { href: "/maintenance/core", icon: MAINTENANCE_ICONS.core, title: "Core Overview" },
        { href: "/maintenance/ai", icon: MAINTENANCE_ICONS.ai, title: "AI Area" },
      ]
    : inAI
    ? [
        { href: "/maintenance", icon: MAINTENANCE_ICONS.home, title: "Home" },
        { href: "/maintenance/core", icon: MAINTENANCE_ICONS.core, title: "Core Overview" },
      ]
    : [
        { href: "/maintenance", icon: MAINTENANCE_ICONS.home, title: "Home" },
        { href: "/maintenance/ai", icon: MAINTENANCE_ICONS.ai, title: "AI Area" },
      ];

  // Grey pill contents: include a 'Start' link for the active area, then area links
  const pill = inAI
    ? [
        { href: "/maintenance/ai", icon: "🏁", title: "AI Start" },
        { href: "/maintenance/ai/settings/project-flows", icon: "🧭", title: "Project Flows" },
        { href: "/maintenance/ai/settings/pipelines", icon: "🛠️", title: "Pipelines" },
        { href: "/maintenance/ai/settings/steps", icon: "🧩", title: "Steps" },
        { href: "/maintenance/ai/settings/ir-schemas", icon: "📐", title: "IR Schemas" },
        { href: "/maintenance/ai/system#logs", icon: "📜", title: "Logs" },
        { href: "/maintenance/ai/optimization/prompts", icon: "📚", title: "Prompts" },
      ]
    : [
        { href: "/maintenance/core", icon: "🏁", title: "Core Start" },
        { href: "/maintenance/core/build-tests", icon: MAINTENANCE_ICONS.buildTests, title: "Build Tests" },
        { href: "/maintenance/core/dead-code", icon: MAINTENANCE_ICONS.deadCode, title: "Dead Code" },
        { href: "/maintenance/core/jest-tests", icon: MAINTENANCE_ICONS.testSuite, title: "Test Suite" },
      ];

  return (
    <div className="bg-transparent">
      <nav className="flex items-center space-x-3" aria-label="Maintenance Navigation">
        {/* Primary: Home, Core */}
        {primary.map((n, idx) => (
          <Link
            key={`${n.href}-primary-${idx}`}
            href={n.href}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md text-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900"
            title={n.title}
            aria-label={n.title}
          >
            <span>{n.icon}</span>
          </Link>
        ))}

        {/* Separator and pill are hidden on maintenance root */}
        {!atRoot && (
          <>
            {/* Separator */}
            <span aria-hidden className="mx-1 h-5 w-px bg-gray-300 inline-block" />

            {/* Group pill: AI pages inside AI area; core pages otherwise */}
            <div className="flex items-center space-x-2 rounded-full bg-gray-100 px-2 py-1 ring-1 ring-gray-200">
              {pill.map((n, idx) => (
                <Link
                  key={`${n.href}-core-${idx}`}
                  href={n.href}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-lg hover:bg-gray-200 text-gray-700 hover:text-gray-900"
                  title={n.title}
                  aria-label={n.title}
                >
                  {/* Use shared SVG for Dead Code when present */}
                  {n.title === "Dead Code" ? (
                    <DeadCodeIcon className="w-5 h-5" />
                  ) : (
                    <span>{n.icon}</span>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
