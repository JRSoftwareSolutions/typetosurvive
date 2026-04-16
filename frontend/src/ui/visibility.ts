import { els } from "../dom/els";
import { state } from "../state";

export function updateLeaveRoomVisibility() {
  const inRoom = Boolean(state.roomCode && state.myPlayerId);
  const display = inRoom ? "" : "none";
  els.leaveBtn.style.display = display;
  els.leaveAfterGameBtn.style.display = display;
  els.leaveInGameBtn.style.display = display;
}

