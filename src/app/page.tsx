"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Overview } from "@/components/Overview";
import { ChatPanel } from "@/components/ChatPanel";
import { AgentEditor } from "@/components/AgentEditor";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TopBar, type ConnState, type View } from "@/components/TopBar";
import type { Agent, State } from "@/lib/api";
import { fetchAgents, fetchState, deleteAgent as apiDeleteAgent } from "@/lib/api";
import { persistedAge, usePersistedState } from "@/lib/persisted-state";

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; agent: Agent }
  | { kind: "delete"; agent: Agent };

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
            <Overview state={state} />
          </div>
          <div className={`absolute inset-0 ${view === "chat" ? "" : "hidden"}`}>
            <ChatPanel agent={selectedAgent} />
          </div>
        </div>
      </main>
      {modal.kind === "create" && (
        <AgentEditor
          mode="create"
          onClose={() => setModal(NONE)}
          onSaved={(saved) => { loadAgents(); setSelectedId(saved.id); }}
        />
      )}
      {modal.kind === "edit" && (
        <AgentEditor
          mode="edit"
          agent={modal.agent}
          onClose={() => setModal(NONE)}
          onSaved={() => loadAgents()}
        />
      )}
      {modal.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${modal.agent.name}?`}
          message={`Registry entry will be removed. The directory at ${modal.agent.path} is NOT touched.`}
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await apiDeleteAgent(modal.agent.id);
            if (selectedId === modal.agent.id) setSelectedId(null);
            await loadAgents();
          }}
          onClose={() => setModal(NONE)}
        />
      )}
    </div>
  );
}
