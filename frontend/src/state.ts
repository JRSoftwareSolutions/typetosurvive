import type { EffectDto } from "./gameLogic";

export type PlayerDto = {
  username?: string;
  ready?: boolean;
  health?: number;
  score?: number;
  deadAt?: number | null;
  leftAt?: number | null;
  joinedAt?: number;
  lastSeenAt?: number;
  lastTypo?: number;
  lastSuccess?: number;
  threatResetElapsedSeconds?: number;
  secondWindUsed?: boolean;
  currentIndex?: number;
  recentSuccesses?: number[];
  nextEffectAllowedAt?: number;
  flowGauge?: number;
  flowActive?: boolean;
};

export type RoomDto = {
  started?: boolean;
  startedAt?: number;
  elapsedSeconds?: number;
  matchEnded?: boolean;
  matchWinnerId?: string | null;
  effects?: unknown[];
  players?: Record<string, PlayerDto>;
  participants?: Record<
    string,
    {
      username?: string;
      health?: number;
      score?: number;
      deadAt?: number | null;
      leftAt?: number | null;
      joinedAt?: number;
      lastSeenAt?: number;
    }
  >;
  wordSequence?: string[];
};

export type State = {
  roomCode: string;
  room: RoomDto | null;
  eventSource: EventSource | null;
  myPlayerId: string | null;
  myUsername: string;
  gameRunning: boolean;
  myCurrentIndex: number;
  currentWord: string;
  activeEffects: EffectDto[];
  health: number;
  score: number;
  timeSurvived: number;
  highScore: number;
  drainInterval: number | null;
  timerInterval: number | null;
  secondWindFlashTimeout: number | null;
  /** Navigation stack: last entry is the visible panel (`index` or a card id). */
  rulesNavStack: string[];
  rulesIndexScrollTop: number;
  lastHealthUpdateAt: number;
  lastFlowGaugeSentAt: number;
  lastRenderAt: number;

  flowGauge: number;
  flowWordHadTypo: boolean;
  flowActive: boolean;
  flowEndsAt: number;
  flowCounter: number;
  flowLastInputValue: string;
  flowLastCharEffectAt: number;

  devBotsEnabled: boolean;
  devBotIds: string[];

  decoyDeferEffectId: string | null;
  decoyDeferIndex: number | null;
};

export const state: State = {
  roomCode: "",
  room: null,
  eventSource: null,
  myPlayerId: null,
  myUsername: "",
  gameRunning: false,
  myCurrentIndex: 0,
  currentWord: "",
  activeEffects: [],
  health: 100,
  score: 0,
  timeSurvived: 0,
  highScore: Number(localStorage.getItem("typeToSurviveHighScore") || 0),
  drainInterval: null,
  timerInterval: null,
  secondWindFlashTimeout: null,
  rulesNavStack: ["index"],
  rulesIndexScrollTop: 0,
  lastHealthUpdateAt: 0,
  lastFlowGaugeSentAt: 0,
  lastRenderAt: 0,

  // Flow state (new mechanic)
  flowGauge: 0,
  flowWordHadTypo: false,
  flowActive: false,
  flowEndsAt: 0,
  flowCounter: 0,
  flowLastInputValue: "",
  flowLastCharEffectAt: 0,

  // Dev-only: local multiplayer test bots (enabled via ?dev=1)
  devBotsEnabled: false,
  devBotIds: [],

  // decoyWord: defer fake word until the word after the one in progress when the effect arrives
  decoyDeferEffectId: null,
  decoyDeferIndex: null,
};

