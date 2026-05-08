"use client";

import type { Agent, State } from "@/lib/api";
import type { Tab } from "@/lib/tabs";
import { ChatPanel } from "../ChatPanel";
import { OverviewPage } from "./OverviewPage";
import { TokensPage } from "./TokensPage";
import { SkillsPage } from "./SkillsPage";
import { MemoryPage } from "./MemoryPage";
import { SubAgentsPage } from "./SubAgentsPage";
import { HooksPage } from "./HooksPage";
import { SettingsPage } from "./SettingsPage";
import { AgentsPage } from "./AgentsPage";

export interface TabActions {
  onOpenFile: (agent: Agent, file: string) => void;
  onNewMemory: (agent: Agent) => void;
  onSkillClick: (agent: Agent, name: string) => void;
  onConsolidateSkill: (agent: Agent, name: string) => void;
  onNewSkill: (agent: Agent) => void;
  onSubAgentClick: (agent: Agent, name: string) => void;
  onNewSubAgent: (agent: Agent) => void;
  onManageHooks: (agent: Agent) => void;
  onAddAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  onSelectAgent: (id: string) => void;
}

interface Props {
  tab: Tab;
  state: State | null;
  agents: Agent[];
  selectedAgent: Agent | null;
  selectedId: string | null;
  actions: TabActions;
}

function bind<T extends unknown[]>(agent: Agent | null, fn: (agent: Agent, ...args: T) => void) {
  return (...args: T) => { if (agent) fn(agent, ...args); };
}

export function TabRouter({ tab, state, agents, selectedAgent, selectedId, actions }: Props) {
  const a = selectedAgent;
  switch (tab) {
    case "overview":
      return <OverviewPage state={state} agentId={a?.id ?? null} />;
    case "tokens":
      return <TokensPage agentId={a?.id ?? null} />;
    case "skills":
      return (
        <SkillsPage
          state={state}
          onSkillClick={bind(a, actions.onSkillClick)}
          onNewSkill={bind(a, actions.onNewSkill)}
          onConsolidate={bind(a, actions.onConsolidateSkill)}
        />
      );
    case "memory":
      return (
        <MemoryPage
          agentId={a?.id ?? null}
          onFileClick={bind(a, actions.onOpenFile)}
          onNewFile={bind(a, actions.onNewMemory)}
        />
      );
    case "sub-agents":
      return (
        <SubAgentsPage
          state={state}
          onSubAgentClick={bind(a, actions.onSubAgentClick)}
          onNewSubAgent={bind(a, actions.onNewSubAgent)}
        />
      );
    case "hooks":
      return <HooksPage state={state} onManage={bind(a, actions.onManageHooks)} />;
    case "settings":
      return <SettingsPage agentId={a?.id ?? null} />;
    case "agents":
      return (
        <AgentsPage
          agents={agents}
          selectedId={selectedId}
          state={state}
          onSelect={actions.onSelectAgent}
          onAddClick={actions.onAddAgent}
          onEditClick={actions.onEditAgent}
          onDeleteClick={actions.onDeleteAgent}
          onOpenFile={actions.onOpenFile}
        />
      );
    case "chat":
      return <ChatPanel agent={a} />;
  }
}
