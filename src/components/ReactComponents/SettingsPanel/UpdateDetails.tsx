import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { PopupModal } from "../../Modal.ts";
import { $updateState, retainUpdatePanel } from "../../../updater/runtimeState.ts";
import { getUpdateBridge, runUpdateAction } from "../../../updater/actions.ts";
import UpdatePanel from "../UpdatePanel.tsx";

export default function UpdateDetails({ onBack }: { onBack: () => void }) {
  const state = useStore($updateState);
  useEffect(retainUpdatePanel, []);
  return (
    <UpdatePanel
      state={state}
      automaticUpdates={Boolean(getUpdateBridge())}
      onBack={onBack}
      onClose={() => PopupModal.hide()}
      onCheck={() => void runUpdateAction("check")}
      onRetry={() =>
        void runUpdateAction(
          state.latestVersion && state.latestVersion !== state.currentVersion ? "download" : "check"
        )
      }
      onReload={() => getUpdateBridge()?.reload()}
    />
  );
}
