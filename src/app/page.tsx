"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AppModals, type ModalState } from "@/components/AppModals";
import { TopBar, type ConnState } from "@/components/TopBar";
import { TabRouter } from "@/components/pages/TabRouter";
import type { Agent, State } from "@/lib/api";
import { fetchAgents, fetchState } from "@/lib/api";
import { persistedAge, usePersistedState } from "@/lib/persisted-state";
import { isTab, type Tab } from "@/lib/tabs";

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
  const hydrated = th && sh;
  const [conn, setConn] = useState<ConnState>("loading");
  const [lastFetchTs, setLastFetchTs] = useState<number | null>(null);
  const [age, setAge] = useState("");
  const [modal, setModal] = useState<ModalState>(NONE);

  const loadAgents = useCallback(async () => {
    try {
      const list = await fetchAgents();
      setAgents(list);
      setSelectedId((cur) => {
        if (cur && list.some((a) => a.id === cur)) return cur;
        return list[0]?.id ?? null;
      });
    } catch (e) { console.error("agents:", e); }
  }, [setSelectedId]);

  const loadState = useCallback(async (agentId: string | null) => {
    setConn("loading");
    try {
      const s = await fetchState(agentId);
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

  useEffect(() => {
    if (lastFetchTs === null) return;
    const t = setInterval(() => setAge(persistedAge(lastFetchTs)), 1000);
    return () => clearInterval(t);
  }, [lastFetchTs]);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;
  const refresh = () => { loadAgents(); loadState(selectedId); };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar tab={tab} onTabChange={setTab} selectedAgent={selectedAgent} agentCount={agents.length} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar tab={tab} selectedAgent={selectedAgent} conn={conn} age={age} onRefresh={refresh} />
        <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50">
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
