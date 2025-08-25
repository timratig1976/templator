import React from "react";

export default function FlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {children}
    </div>
  );
}
