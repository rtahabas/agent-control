"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Overview } from "@/components/Overview";
import { ChatPanel } from "@/components/ChatPanel";
import { AppModals, type ModalState } from "@/components/AppModals";
import { TopBar, type ConnState, type View } from "@/components/TopBar";
import type { Agent, State } from "@/lib/api";
import { fetchAgents, fetchState } from "@/lib/api";
import { persistedAge, usePersistedState } from "@/lib/persisted-state";

const NONE: ModalState = { kind: "none" };

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [view, setView, vh] = usePersistedState<View>("app:view", "overview", (raw) =>
    raw === "chat" ? "chat" : "overview"
  );
  const [selectedId, setSelectedId, sh] = usePersistedState<string | null>(
    "app:selectedId",
    null,
    (raw) => raw
  );
  const hydrated = vh && sh;
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
    } catch (e) {
      console.error("agents:", e);
    }
  }, [setSelectedId]);

  const loadState = useCallback(async (agentId: string | null) => {
    setConn("loading");
    try {
      const s = await fetchState(agentId);
      setState(s);
      setLastFetchTs(Date.now());
      setConn("ok");
    } catch (e) {
      console.error("state:", e);
      setConn("error");
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    loadAgents();
    const a = setInterval(loadAgents, 5000);
    return () => clearInterval(a);
  }, [hydrated, loadAgents]);

  useEffect(() => {
    if (!hydrated) return;
    loadState(selectedId);
    const s = setInterval(() => loadState(selectedId), 5000);
    return () => clearInterval(s);
  }, [hydrated, loadState, selectedId]);

  useEffect(() => {
    if (lastFetchTs === null) return;
    const t = setInterval(() => setAge(persistedAge(lastFetchTs)), 1000);
    return () => clearInterval(t);
  }, [lastFetchTs]);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        agents={agents}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={loadAgents}
        onAddClick={() => setModal({ kind: "create" })}
        onEditClick={(agent) => setModal({ kind: "edit", agent })}
        onDeleteClick={(agent) => setModal({ kind: "delete", agent })}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          selectedAgent={selectedAgent}
          view={view}
          onViewChange={setView}
          conn={conn}
          age={age}
          onRefresh={() => { loadAgents(); loadState(selectedId); }}
        />
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto bg-zinc-50 ${view === "overview" ? "" : "hidden"}`}>
            <Overview
              state={state}
              onFileClick={(file) => { if (selectedAgent) setModal({ kind: "file", agent: selectedAgent, file }); }}
              onNewMemory={() => { if (selectedAgent) setModal({ kind: "new-file", agent: selectedAgent }); }}
              onBrowseMemory={() => { if (selectedAgent) setModal({ kind: "browse", agent: selectedAgent }); }}
              onSkillClick={(name) => { if (selectedAgent) setModal({ kind: "skill", agent: selectedAgent, name }); }}
              onNewSkill={() => { if (selectedAgent) setModal({ kind: "new-skill", agent: selectedAgent }); }}
              onSubAgentClick={(name) => { if (selectedAgent) setModal({ kind: "sub-agent", agent: selectedAgent, name }); }}
              onNewSubAgent={() => { if (selectedAgent) setModal({ kind: "new-sub-agent", agent: selectedAgent }); }}
              onManageHooks={() => { if (selectedAgent) setModal({ kind: "hooks", agent: selectedAgent }); }}
            />
          </div>
          <div className={`absolute inset-0 ${view === "chat" ? "" : "hidden"}`}>
            <ChatPanel agent={selectedAgent} />
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
