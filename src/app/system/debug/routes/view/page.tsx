"use client";

import * as React from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { SystemDebugRoutesViewer } from "@/components/admin/system-debug-routes-viewer";

export default function SystemDebugRoutesViewPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="pb-2 border-b border-border">
          <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground">
            System Debug Routes Viewer
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Staff-restricted diagnostic view for inspecting registered LexmaCasto backend routes.
          </p>
        </div>
        <SystemDebugRoutesViewer />
      </div>
    </AdminShell>
  );
}
