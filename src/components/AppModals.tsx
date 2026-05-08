"use client";

import type { Agent } from "@/lib/api";
import { deleteAgent as apiDeleteAgent } from "@/lib/api";
import { AgentEditor } from "./AgentEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileViewer } from "./FileViewer";
import { NewFileModal } from "./NewFileModal";
import { MemoryBrowser } from "./MemoryBrowser";
import { SkillViewer } from "./SkillViewer";
import { NewSkillModal } from "./NewSkillModal";
import { SubAgentViewer } from "./SubAgentViewer";
import { NewSubAgentModal } from "./NewSubAgentModal";

export type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; agent: Agent }
  | { kind: "delete"; agent: Agent }
  | { kind: "file"; agent: Agent; file: string }
  | { kind: "new-file"; agent: Agent }
  | { kind: "browse"; agent: Agent }
  | { kind: "skill"; agent: Agent; name: string }
  | { kind: "new-skill"; agent: Agent }
  | { kind: "sub-agent"; agent: Agent; name: string }
  | { kind: "new-sub-agent"; agent: Agent };

interface Props {
  modal: ModalState;
  selectedId: string | null;
  onClose: () => void;
  onAgentSaved: (saved: Agent) => void;
  onAgentEdited: () => void;
  onAgentDeleted: (id: string) => Promise<void>;
  onOpenFile: (agent: Agent, file: string) => void;
  onOpenSkill: (agent: Agent, name: string) => void;
  onOpenSubAgent: (agent: Agent, name: string) => void;
}

export function AppModals({ modal, onClose, onAgentSaved, onAgentEdited, onAgentDeleted, onOpenFile, onOpenSkill, onOpenSubAgent }: Props) {
  if (modal.kind === "none") return null;
  if (modal.kind === "create") {
    return <AgentEditor mode="create" onClose={onClose} onSaved={onAgentSaved} />;
  }
  if (modal.kind === "edit") {
    return <AgentEditor mode="edit" agent={modal.agent} onClose={onClose} onSaved={onAgentEdited} />;
  }
  if (modal.kind === "delete") {
    return (
      <ConfirmDialog
        title={`Delete ${modal.agent.name}?`}
        message={`Registry entry will be removed. The directory at ${modal.agent.path} is NOT touched.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await apiDeleteAgent(modal.agent.id);
          await onAgentDeleted(modal.agent.id);
        }}
        onClose={onClose}
      />
    );
  }
  if (modal.kind === "file") {
    return <FileViewer agentId={modal.agent.id} file={modal.file} onClose={onClose} />;
  }
  if (modal.kind === "new-file") {
    return (
      <NewFileModal
        agentId={modal.agent.id}
        onClose={onClose}
        onCreated={(file) => onOpenFile(modal.agent, file)}
      />
    );
  }
  if (modal.kind === "browse") {
    return (
      <MemoryBrowser
        agentId={modal.agent.id}
        onClose={onClose}
        onSelect={(file) => onOpenFile(modal.agent, file)}
      />
    );
  }
  if (modal.kind === "skill") {
    return <SkillViewer agentId={modal.agent.id} skillName={modal.name} onClose={onClose} />;
  }
  if (modal.kind === "new-skill") {
    return (
      <NewSkillModal
        agentId={modal.agent.id}
        onClose={onClose}
        onCreated={(name) => onOpenSkill(modal.agent, name)}
      />
    );
  }
  if (modal.kind === "sub-agent") {
    return <SubAgentViewer agentId={modal.agent.id} subName={modal.name} onClose={onClose} />;
  }
  return (
    <NewSubAgentModal
      agentId={modal.agent.id}
      onClose={onClose}
      onCreated={(name) => onOpenSubAgent(modal.agent, name)}
    />
  );
}
