import { createStore } from "zustand";
import { persist } from "zustand/middleware";

export type Timeframe = "Recent" | "Yesterday" | "Last 7 Days" | "Last 30 Days";
export type Spec = "web" | "mobile";

export interface UserActivityState {
  selectedTimeframe: Timeframe;
  spec: Spec;
  model: string;
}

export interface UserActivityActions {
  setSelectedTimeframe: (timeframe: Timeframe) => void;
  setSpec: (spec: Spec) => void;
  setModel: (model: string) => void;
}

export type ProjectsStore = UserActivityState & UserActivityActions;

const defaultState: UserActivityState = {
  selectedTimeframe: "Recent",
  spec: "web",
  model: "gemma4:31b",
};

export const createUserActivityStore = (
  initState: Partial<UserActivityState> = {},
) =>
  createStore<ProjectsStore>()(
    persist(
      (set) => ({
        ...defaultState,
        ...initState,
        setSelectedTimeframe: (selectedTimeframe) => set({ selectedTimeframe }),
        setSpec: (spec) => set({ spec }),
        setModel: (model) => set({ model }),
      }),
      {
        name: "logic-user-activity",
      },
    ),
  );
