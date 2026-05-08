"use client";

import type { Agent } from "@/lib/api";
import { deleteAgent as apiDeleteAgent } from "@/lib/api";
import { AgentEditor } from "./AgentEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileViewer } from "./FileViewer";

export type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; agent: Agent }
  | { kind: "delete"; agent: Agent }
  | { kind: "file"; agent: Agent; file: string };

interface Props {
  modal: ModalState;
  selectedId: string | null;
  onClose: () => void;
  onAgentSaved: (saved: Agent) => void;
  onAgentEdited: () => void;
  onAgentDeleted: (id: string) => Promise<void>;
}

export function AppModals({ modal, onClose, onAgentSaved, onAgentEdited, onAgentDeleted }: Props) {
  if (modal.kind === "none") return null;
  if (modal.kind === "create") {
    return <AgentEditor mode="create" onClose={onClose} onSaved={onAgentSaved} />;
  }
  if (modal.kind === "edit") {
    return (
      <AgentEditor
        mode="edit"
        agent={modal.agent}
        onClose={onClose}
        onSaved={onAgentEdited}
      />
    );
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
  return <FileViewer agentId={modal.agent.id} file={modal.file} onClose={onClose} />;
}
