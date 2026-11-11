export type TabType = "tasks" | "calendar" | "rewards" | "meals" | "shopping";
export type TaskCategory = "school" | "chore";
export type RepeatMode = "none" | "daily" | "weekdays" | "custom";

export const DAY_ABBRS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface Kid {
  id: string;
  name: string;
  stars: number;
  color: string;
}

export interface TaskItem {
  id: string;
  title: string;
  assignee: string;
  category: TaskCategory;
  points: number;
  completed: boolean;
  repeat: RepeatMode;
  repeatDays: string[];
  lastCompletedDate?: string;
  imageUrl?: string;
  /** False when a repeating task is not scheduled for today (hidden from the chart). */
  dueToday: boolean;
}

export interface RewardItem {
  id: string;
  title: string;
  cost: number;
  icon: string;
  imageUrl?: string;
  /** True: kids can pool points together. False: only one kid may fund it at a time. */
  combinable: boolean;
}

/** Unclaimed points a kid has put into a reward's "jar". */
export interface Contribution {
  id: string;
  rewardId: string;
  kidId: string;
  amount: number;
}

export interface MealItem {
  id: string;
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface ShoppingItem {
  id: string;
  item: string;
  category: string;
  checked: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  location?: string;
}

export interface WeatherData {
  current_weather?: { temperature: number };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

export interface CelebrationData {
  name: string;
  headline: string;
  title: string;
  points?: number;
  icon: string;
  imageUrl?: string;
}
