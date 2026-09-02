"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppModals, type ModalState } from "@/components/AppModals";
import { TopBar, type ConnState } from "@/components/TopBar";
import { TabRouter } from "@/components/pages/TabRouter";
import { ChatPanel } from "@/components/ChatPanel";
import type { Agent, State } from "@/lib/api";
import { fetchAgents, fetchState } from "@/lib/api";
import { usePersistedState } from "@/lib/persisted-state";
import { isTab, type Tab } from "@/lib/tabs";
import { useAttentionSignal } from "@/lib/use-attention-signal";

const NONE: ModalState = { kind: "none" };

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab, th] = usePersistedState<Tab>("app:tab", "overview", (raw) =>
    raw !== null && isTab(raw) ? raw : "overview"
  );
  const [selectedId, setSelectedId, sh] = usePersistedState<string | null>(
    "app:selectedId",
    null,
    (raw) => raw
  );
  // Folding the rail is a per-window preference, so it rides the same
  // session-scoped store as the tab and the selected agent.
  const [rail, setRail] = usePersistedState<string>("app:rail", "open", (raw) =>
    raw === "closed" ? "closed" : "open"
  );
  const hydrated = th && sh;
  const [conn, setConn] = useState<ConnState>("loading");
  const [lastFetchTs, setLastFetchTs] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>(NONE);

  const loadAgents = useCallback(async () => {
    try {
      const list = await fetchAgents();
      setAgents(list);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlAgent = params.get("agent");
        const urlTab = params.get("tab");
        if (urlTab && isTab(urlTab)) setTab(urlTab);
        setSelectedId((cur) => {
          if (urlAgent && list.some((a) => a.id === urlAgent)) return urlAgent;
          if (cur && list.some((a) => a.id === cur)) return cur;
          return list[0]?.id ?? null;
        });
      } else {
        setSelectedId((cur) => {
          if (cur && list.some((a) => a.id === cur)) return cur;
          return list[0]?.id ?? null;
        });
      }
    } catch (e) { console.error("agents:", e); }
  }, [setSelectedId, setTab]);

  const loadState = useCallback(async (agentId: string | null, opts?: { fresh?: boolean }) => {
    setConn("loading");
    try {
      const s = await fetchState(agentId, opts);
      setState(s); setLastFetchTs(Date.now()); setConn("ok");
    } catch (e) { console.error("state:", e); setConn("error"); }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    loadAgents();
    const onVisible = () => { if (document.visibilityState === "visible") loadAgents(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hydrated, loadAgents]);

  useEffect(() => {
    if (!hydrated) return;
    loadState(selectedId);
    const onVisible = () => { if (document.visibilityState === "visible") loadState(selectedId); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hydrated, loadState, selectedId]);

  // Sync (selectedId, tab) → URL (?agent=<id>&tab=<tab>) for bookmarkable / shareable links.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let mutated = false;
    if (selectedId && params.get("agent") !== selectedId) {
      params.set("agent", selectedId); mutated = true;
    } else if (!selectedId && params.has("agent")) {
      params.delete("agent"); mutated = true;
    }
    if (tab && params.get("tab") !== tab) {
      params.set("tab", tab); mutated = true;
    }
    if (mutated) {
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, [hydrated, selectedId, tab]);

  // Listen to browser back/forward — sync URL back into state.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const urlAgent = params.get("agent");
      const urlTab = params.get("tab");
      if (urlAgent) setSelectedId(urlAgent);
      if (urlTab && isTab(urlTab)) setTab(urlTab);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hydrated, setSelectedId, setTab]);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;
  // Watches every agent, so a second one blocking on a card is noticed from here.
  useAttentionSignal(agents, selectedId);
  const refresh = () => { loadAgents(); loadState(selectedId, { fresh: true }); };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        tab={tab}
        onTabChange={setTab}
        selectedAgent={selectedAgent}
        agents={agents}
        onSelectAgent={setSelectedId}
        collapsed={rail === "closed"}
        onToggle={() => setRail((r) => (r === "closed" ? "open" : "closed"))}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar tab={tab} selectedAgent={selectedAgent} conn={conn} lastFetchTs={lastFetchTs} onRefresh={refresh} />
        <div className="flex-1 min-h-0 relative bg-zinc-50">
          <div className={`absolute inset-0 overflow-y-auto ${tab === "chat" ? "hidden" : ""}`}>
            <TabRouter
              tab={tab}
              state={state}
              agents={agents}
              selectedAgent={selectedAgent}
              selectedId={selectedId}
              actions={{
                onOpenFile: (agent, file) => setModal({ kind: "file", agent, file }),
                onNewMemory: (agent) => setModal({ kind: "new-file", agent }),
                onSkillClick: (agent, name) => setModal({ kind: "skill", agent, name }),
                onConsolidateSkill: (agent, name) => setModal({ kind: "skill", agent, name, consolidate: true }),
                onNewSkill: (agent) => setModal({ kind: "new-skill", agent }),
                onSubAgentClick: (agent, name) => setModal({ kind: "sub-agent", agent, name }),
                onNewSubAgent: (agent) => setModal({ kind: "new-sub-agent", agent }),
                onManageHooks: (agent) => setModal({ kind: "hooks", agent }),
                onAddAgent: () => setModal({ kind: "create" }),
                onEditAgent: (agent) => setModal({ kind: "edit", agent }),
                onDeleteAgent: (agent) => setModal({ kind: "delete", agent }),
                onSelectAgent: setSelectedId,
              }}
            />
          </div>
          <div className={`absolute inset-0 ${tab === "chat" ? "" : "hidden"}`}>
            {/* Mounted behind other tabs on purpose so a run keeps streaming —
                hence `visible`, which tells it whether anyone is looking. */}
            <ChatPanel agent={selectedAgent} visible={tab === "chat"} />
          </div>
        </div>
      </main>
      <AppModals
        modal={modal}
        selectedId={selectedId}
        onClose={() => setModal(NONE)}
        onAgentSaved={(saved) => { loadAgents(); setSelectedId(saved.id); setModal(NONE); }}
        onAgentEdited={() => { loadAgents(); setModal(NONE); }}
        onAgentDeleted={async (id) => {
          if (selectedId === id) setSelectedId(null);
          await loadAgents();
          setModal(NONE);
        }}
        onOpenFile={(agent, file) => setModal({ kind: "file", agent, file })}
        onOpenSkill={(agent, name) => setModal({ kind: "skill", agent, name })}
        onOpenSubAgent={(agent, name) => setModal({ kind: "sub-agent", agent, name })}
      />
    </div>
  );
}
