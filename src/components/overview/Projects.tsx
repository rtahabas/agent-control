"use client";

import type { Project, ProjectStatus } from "@/lib/api";
import { SectionHead } from "./Section";

const STATUS_BADGE: Record<ProjectStatus, string> = {
  clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dirty: "bg-amber-50 text-amber-700 border-amber-200",
  untracked: "bg-blue-50 text-blue-700 border-blue-200",
  "n/a": "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  clean: "bg-emerald-500",
  dirty: "bg-amber-500",
  untracked: "bg-blue-500",
  "n/a": "bg-zinc-300",
};

export function Projects({ projects }: { projects: Project[] }) {
  return (
    <section>
      <SectionHead title="Projects" count={projects.length} />
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Branch</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Last commit</th>
              <th className="text-right font-medium px-4 py-2.5">PRs</th>
              <th className="text-right font-medium px-4 py-2.5">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {projects.map((p) => (
              <Row key={p.name} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ p }: { p: Project }) {
  return (
    <tr className="hover:bg-zinc-50 transition">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-900">{p.name}</div>
        {p.repo && <div className="text-xs text-zinc-400 mono mt-0.5">{p.repo}</div>}
      </td>
      <td className="px-4 py-3 text-zinc-600 mono text-xs">{p.branch || "—"}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[p.status]}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
          {p.status}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-500 mono text-xs">{p.last_commit || "—"}</td>
      <td className={`px-4 py-3 text-right mono ${!p.open_prs ? "text-zinc-400" : "text-zinc-900 font-medium"}`}>
        {p.open_prs == null ? "—" : p.open_prs}
      </td>
      <td className={`px-4 py-3 text-right mono ${!p.open_issues ? "text-zinc-400" : "text-zinc-900 font-medium"}`}>
        {p.open_issues == null ? "—" : p.open_issues}
      </td>
    </tr>
  );
}
