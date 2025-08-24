"use client";

import React from "react";
import DesignUploadsManager from "@/components/DesignUploadsManager";

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Upload Design</h1>
        <p className="text-gray-600">Manage your design uploads below. After uploading, proceed to the Split step from the left navigation.</p>
      </div>
      <DesignUploadsManager />
    </div>
  );
}
