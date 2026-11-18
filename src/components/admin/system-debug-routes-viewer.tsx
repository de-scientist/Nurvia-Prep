"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  RefreshCw,
  Route,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Shield,
} from "lucide-react";
import { nurviaApi } from "@/lib/api-client";
import type {
  SystemDebugRouteRecord,
  SystemDebugRoutesPayload,
} from "@/lib/lexmacasto/contracts";

const HTTP_METHOD_OPTIONS = ["", "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

export function SystemDebugRoutesViewer() {
  const [target, setTarget] = React.useState<"view" | "routes">("view");
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [methodFilter, setMethodFilter] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(25);

  const [payload, setPayload] = React.useState<SystemDebugRoutesPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | undefined>(undefined);
  const [selectedRoute, setSelectedRoute] = React.useState<SystemDebugRouteRecord | null>(null);

  const fetchRoutes = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(undefined);

    const res = await nurviaApi.getSystemDebugRoutes({
      target,
      search: searchQuery || undefined,
      method: methodFilter || undefined,
      group: groupFilter || undefined,
      page,
      perPage,
    });

    if (res.success && res.data) {
      setPayload(res.data);
      setSelectedRoute(res.data.routes[0] ?? null);
    } else {
      setPayload(null);
      setSelectedRoute(null);
      setErrorCode(res.errorCode);
      setError(
        res.message ||
          "Unable to retrieve system route diagnostics from the shared LexmaCasto backend."
      );
    }
    setLoading(false);
  }, [target, searchQuery, methodFilter, groupFilter, page, perPage]);

  React.useEffect(() => {
    void fetchRoutes();
  }, [fetchRoutes]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setMethodFilter("");
    setGroupFilter("");
    setPage(1);
  };

  const routes = payload?.routes ?? [];
  const totalPages = payload?.totalPages ?? 1;
  const totalCount = payload?.totalCount ?? 0;

  // Determine which columns are actually supplied by the verified upstream records
  const hasMethodCol = routes.some((r) => Boolean(r.method || (r.methods && r.methods.length > 0)));
  const hasPathCol = routes.some((r) => Boolean(r.path));
  const hasControllerCol = routes.some((r) => Boolean(r.controller || r.handler || r.action));
  const hasGroupCol = routes.some((r) => Boolean(r.group || r.area));
  const hasAuthCol = routes.some(
    (r) => r.auth !== undefined || (Array.isArray(r.roles) && r.roles.length > 0)
  );

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Route className="w-5 h-5 text-brand-teal" />
            <h2 className="font-brand text-lg font-bold text-foreground">
              System Debug Routes Inspector
            </h2>
            <Badge variant="outline" className="font-mono text-[11px]">
              {target === "view" ? "/system/debug/routes/view" : "/system/debug/routes"}
            </Badge>
          </div>
          <p className="text-xs text-foreground-secondary">
            Read-only diagnostic route table from the shared LexmaCasto backend. Only fields explicitly supplied by the upstream contract are displayed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="debug-route-target" className="sr-only">
            Upstream Endpoint Target
          </label>
          <select
            id="debug-route-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value === "routes" ? "routes" : "view");
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs font-mono text-foreground"
          >
            <option value="view">/system/debug/routes/view</option>
            <option value="routes">/system/debug/routes</option>
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchRoutes()}
            disabled={loading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Routes
          </Button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <form
        onSubmit={handleFilterSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
        aria-label="Filter system debug routes"
      >
        <div className="lg:col-span-2 relative">
          <label htmlFor="debug-routes-search" className="sr-only">
            Search routes
          </label>
          <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="debug-routes-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by route path, controller, or handler…"
            maxLength={120}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-surface text-xs text-foreground placeholder:text-foreground-muted"
          />
        </div>

        <div>
          <label htmlFor="debug-routes-method" className="sr-only">
            HTTP Method Filter
          </label>
          <select
            id="debug-routes-method"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground"
          >
            <option value="">All HTTP Methods</option>
            {HTTP_METHOD_OPTIONS.filter(Boolean).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="debug-routes-group" className="sr-only">
            Group or Controller Filter
          </label>
          <input
            id="debug-routes-group"
            type="text"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter group / controller…"
            maxLength={120}
            className="w-full h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground placeholder:text-foreground-muted"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" className="h-9 text-xs flex-1">
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleResetFilters}
            className="h-9 text-xs"
          >
            Reset
          </Button>
        </div>
      </form>

      {/* Loading State */}
      {loading && (
        <div
          className="py-12 text-center text-sm text-foreground-secondary"
          aria-live="polite"
        >
          Querying upstream system route diagnostics…
        </div>
      )}

      {/* Honest Error / Upstream Blocked State */}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Upstream Route Diagnostics Unavailable</span>
            {errorCode && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {errorCode}
              </Badge>
            )}
          </div>
          <p>{error}</p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300/90">
            Note: The shared LexmaCasto endpoint (<code>/system/debug/routes/view</code>) requires an active backend-authorized session and returns <code>401 Unauthorized</code> or <code>302 Found</code> (redirecting to <code>/web/pages/entrance</code>) when unprovisioned for external API inspection. NURVIA does not fabricate or infer route records when upstream access is blocked.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && routes.length === 0 && (
        <div
          className="rounded-xl border border-border bg-surface-muted/30 p-8 text-center space-y-2"
          aria-live="polite"
        >
          <Info className="w-5 h-5 text-foreground-muted mx-auto" />
          <p className="text-sm font-medium text-foreground">
            No routes returned by the upstream endpoint
          </p>
          <p className="text-xs text-foreground-secondary">
            The backend returned an empty route collection for the current query parameters.
          </p>
        </div>
      )}

      {/* Verified Route Table & Details Inspector */}
      {!loading && !error && routes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted/60 text-foreground-secondary border-b border-border">
                <tr>
                  {hasMethodCol && <th className="py-2.5 px-3 font-semibold">Method</th>}
                  {hasPathCol && <th className="py-2.5 px-3 font-semibold">Route Path</th>}
                  {hasControllerCol && (
                    <th className="py-2.5 px-3 font-semibold">Controller / Handler</th>
                  )}
                  {hasGroupCol && <th className="py-2.5 px-3 font-semibold">Group</th>}
                  {hasAuthCol && <th className="py-2.5 px-3 font-semibold">Auth (Supplied)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {routes.map((r, idx) => {
                  const isSelected = selectedRoute === r;
                  return (
                    <tr
                      key={`${r.method ?? "ANY"}-${r.path ?? idx}-${idx}`}
                      onClick={() => setSelectedRoute(r)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedRoute(r);
                        }
                      }}
                      aria-selected={isSelected}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-brand-teal/10"
                          : "hover:bg-surface-muted/40"
                      }`}
                    >
                      {hasMethodCol && (
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                          {r.method ?? (r.methods ? r.methods.join(", ") : "—")}
                        </td>
                      )}
                      {hasPathCol && (
                        <td className="py-2.5 px-3 font-mono break-all">
                          {r.path ?? "—"}
                        </td>
                      )}
                      {hasControllerCol && (
                        <td className="py-2.5 px-3 font-mono text-foreground-secondary">
                          {[r.controller, r.action ?? r.handler].filter(Boolean).join(".") || "—"}
                        </td>
                      )}
                      {hasGroupCol && (
                        <td className="py-2.5 px-3 text-foreground-secondary">
                          {r.group ?? r.area ?? "—"}
                        </td>
                      )}
                      {hasAuthCol && (
                        <td className="py-2.5 px-3">
                          {r.auth !== undefined ? String(r.auth) : r.roles?.join(", ") ?? "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Route Details Panel (only displays fields supplied by upstream) */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Shield className="w-4 h-4 text-brand-teal" />
              <h3 className="font-brand text-sm font-bold text-foreground">
                Route Contract Details
              </h3>
            </div>

            {selectedRoute ? (
              <dl className="space-y-2 text-xs">
                {selectedRoute.method && (
                  <div>
                    <dt className="text-foreground-muted">HTTP Method</dt>
                    <dd className="font-mono font-semibold">{selectedRoute.method}</dd>
                  </div>
                )}
                {selectedRoute.path && (
                  <div>
                    <dt className="text-foreground-muted">Route Path</dt>
                    <dd className="font-mono break-all">{selectedRoute.path}</dd>
                  </div>
                )}
                {selectedRoute.controller && (
                  <div>
                    <dt className="text-foreground-muted">Controller</dt>
                    <dd className="font-mono">{selectedRoute.controller}</dd>
                  </div>
                )}
                {selectedRoute.action && (
                  <div>
                    <dt className="text-foreground-muted">Action</dt>
                    <dd className="font-mono">{selectedRoute.action}</dd>
                  </div>
                )}
                {selectedRoute.handler && (
                  <div>
                    <dt className="text-foreground-muted">Handler</dt>
                    <dd className="font-mono break-all">{selectedRoute.handler}</dd>
                  </div>
                )}
                {(selectedRoute.group || selectedRoute.area) && (
                  <div>
                    <dt className="text-foreground-muted">Group / Area</dt>
                    <dd className="font-mono">{selectedRoute.group ?? selectedRoute.area}</dd>
                  </div>
                )}
                {selectedRoute.name && (
                  <div>
                    <dt className="text-foreground-muted">Route Name</dt>
                    <dd className="font-mono">{selectedRoute.name}</dd>
                  </div>
                )}
                {selectedRoute.auth !== undefined && (
                  <div>
                    <dt className="text-foreground-muted">Supplied Auth Indicator</dt>
                    <dd className="font-mono">{String(selectedRoute.auth)}</dd>
                  </div>
                )}
                {selectedRoute.roles && selectedRoute.roles.length > 0 && (
                  <div>
                    <dt className="text-foreground-muted">Supplied Roles / Policies</dt>
                    <dd className="font-mono">{selectedRoute.roles.join(", ")}</dd>
                  </div>
                )}
                {selectedRoute.parameters && selectedRoute.parameters.length > 0 && (
                  <div>
                    <dt className="text-foreground-muted">Parameters</dt>
                    <dd className="font-mono">{selectedRoute.parameters.join(", ")}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-xs text-foreground-secondary">
                Select a route row to inspect its upstream metadata.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && !error && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border text-xs text-foreground-secondary">
          <div>
            Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total routes)
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="debug-routes-per-page" className="sr-only">
              Routes per page
            </label>
            <select
              id="debug-routes-per-page"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5 text-xs"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
