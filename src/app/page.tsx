"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Calendar as CalendarIcon,
  Utensils,
  Trophy,
  ShoppingCart,
  Image as ImageIcon,
  Plus,
  Lock,
  Unlock,
  CloudSun,
  Settings,
} from "lucide-react";
import Celebration from "@/components/Celebration";
import TasksTab from "@/components/TasksTab";
import RewardsTab from "@/components/RewardsTab";
import { PhotoFrame, SleepScreen } from "@/components/Screensaver";
import SettingsModal from "@/components/SettingsModal";
import KidsManager from "@/components/KidsManager";
import { CalendarTab, ShoppingTab } from "@/components/OtherTabs";
import MealsTab from "@/components/MealsTab";
import { MealEditor, MealPlanner, MealDay } from "@/components/MealModals";
import { AddRewardModal, AddTaskModal, NewReward, NewTask, PinModal } from "@/components/Modals";
import { DEMO_CONTRIBUTIONS, DEMO_KIDS, DEMO_MEALS, DEMO_REWARDS, DEMO_SHOPPING, DEMO_TASKS } from "@/lib/demoData";
import { mealFor } from "@/lib/dates";
import { inSleepWindow, nextPriority, planTaskMove, remainingCost, todayIn, validateDeposit, type TaskPlacement } from "@/lib/rules";
import { playVictorySound } from "@/lib/sound";
import type {
  CalendarEvent,
  CelebrationData,
  Contribution,
  Kid,
  MealItem,
  Redemption,
  RewardItem,
  SleepSettings,
  ShoppingItem,
  TabType,
  TaskItem,
  WeatherData,
} from "@/lib/types";

const NAV_TABS: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "tasks", label: "Today", icon: CheckCircle2 },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "meals", label: "Meals", icon: Utensils },
  { id: "shopping", label: "Groceries", icon: ShoppingCart },
];

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function FamilyWallPlanner() {
  const [activeTab, setActiveTab] = useState<TabType>("tasks");
  const [pin, setPin] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKids, setShowKids] = useState(false);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [timeZone, setTimeZone] = useState("");
  const [sleep, setSleep] = useState<SleepSettings>({ enabled: false, sleepAt: "21:00", wakeAt: "06:30" });
  const [awakeUntil, setAwakeUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [kids, setKids] = useState<Kid[]>(DEMO_KIDS);
  const [tasks, setTasks] = useState<TaskItem[]>(DEMO_TASKS);
  const [rewards, setRewards] = useState<RewardItem[]>(DEMO_REWARDS);
  const [contributions, setContributions] = useState<Contribution[]>(DEMO_CONTRIBUTIONS);
  const [meals, setMeals] = useState<MealItem[]>(DEMO_MEALS);
  const [shopping, setShopping] = useState<ShoppingItem[]>(DEMO_SHOPPING);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [newShoppingItem, setNewShoppingItem] = useState("");

  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [notice, setNotice] = useState("");

  const [screensaverActive, setScreensaverActive] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [editMealDate, setEditMealDate] = useState<string | null>(null);
  const [planMonth, setPlanMonth] = useState<string | null>(null);
  const [today, setToday] = useState("");

  const pinRef = useRef("");
  pinRef.current = pin;

  // Optimistic-update bookkeeping: screens change instantly, saves run in order in the background.
  const seqRef = useRef(0); // bumps on every local change
  const pendingRef = useRef(0); // saves still in flight
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const idMapRef = useRef<Record<string, string>>({}); // temporary id -> real Airtable id
  const resolveId = (id: string) => idMapRef.current[id] ?? id;

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 8000);
  }, []);

  /** POST to the hub API. Throws with the server's message on failure. */
  const hubPost = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-family-pin": pinRef.current },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data as { id?: string; claimed?: boolean; contributionId?: string; redemptionId?: string; created?: Record<string, string> };
  }, []);

  const fetchAllData = useCallback(async (activePin: string) => {
    const startSeq = seqRef.current;
    try {
      const headers = { "x-family-pin": activePin };
      const [hubRes, extRes] = await Promise.all([fetch("/api/hub", { headers }), fetch("/api/external", { headers })]);

      if (hubRes.ok) {
        const hub = await hubRes.json();
        setIsLiveMode(true);
        if (hub.timeZone) setTimeZone(hub.timeZone);
        // Don't let a sync that started before (or during) a local change overwrite it with stale data.
        if (seqRef.current === startSeq && pendingRef.current === 0) {
          if (hub.kids?.length) setKids(hub.kids);
          if (hub.tasks) setTasks(hub.tasks);
          if (hub.rewards) setRewards(hub.rewards);
          if (hub.contributions) setContributions(hub.contributions);
          if (hub.meals?.length) setMeals(hub.meals);
          if (hub.shopping) setShopping(hub.shopping);
          if (hub.redemptions) setRedemptions(hub.redemptions);
        }
      } else if (hubRes.status === 401) {
        // Only a rejected PIN means demo mode. A temporary server or Airtable error must not
        // switch to demo mode, or later taps would silently stop saving.
        setIsLiveMode(false);
      }

      if (extRes.ok) {
        const ext = await extRes.json();
        if (ext.weather) setWeather(ext.weather);
        if (ext.events) setEvents(ext.events);
        if (ext.photos?.length) setPhotos(ext.photos);
      }
    } catch (err) {
      console.error("Sync error:", err);
    }
  }, []);

  // Opened from the iPad home screen? Then there is no browser toolbar, so drop the extra bottom spacing.
  useEffect(() => {
    const standalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    document.documentElement.classList.toggle("standalone", standalone);
  }, []);

  useEffect(() => {
    const savedPin = localStorage.getItem("family_hub_pin") || "";
    setPin(savedPin);
    pinRef.current = savedPin;
    try {
      const saved = localStorage.getItem("family_hub_sleep");
      if (saved) setSleep(JSON.parse(saved));
    } catch {
      // ignore corrupt or unavailable storage
    }
    fetchAllData(savedPin);
    const syncTimer = setInterval(() => fetchAllData(pinRef.current), 60000);
    return () => clearInterval(syncTimer);
  }, [fetchAllData]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const tz = timeZone ? { timeZone } : {};
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...tz }));
      setCurrentDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...tz }));
      setToday(timeZone ? todayIn(timeZone, now).date : localDate());
      setNowMs(now.getTime());
    };
    updateClock();
    const t = setInterval(updateClock, 10000);
    return () => clearInterval(t);
  }, [timeZone]);

  // When the day rolls over on the device, re-sync so repeating tasks reset right away.
  const lastDayRef = useRef("");
  useEffect(() => {
    if (!today) return;
    if (lastDayRef.current && lastDayRef.current !== today) {
      if (isLiveMode) fetchAllData(pinRef.current);
      else setTasks((prev) => prev.map((t) => (t.repeat !== "none" ? { ...t, completed: false } : t)));
    }
    lastDayRef.current = today;
  }, [today, isLiveMode, fetchAllData]);

  const resetIdleTimer = useCallback(() => {
    setScreensaverActive(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setScreensaverActive(true), 180000);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const closeCelebration = useCallback(() => setCelebration(null), []);
  const celebrate = (data: CelebrationData) => {
    playVictorySound();
    setCelebration(data);
  };

  /**
   * Queues a background save. Saves run one at a time, in the order tapped, so quick taps can't
   * overwrite each other. If one fails, `revert` undoes just that change and an error is shown.
   */
  const save = <T,>(remote: () => Promise<T>, opts: { revert: () => void; error: string; onDone?: (r: T) => void }) => {
    seqRef.current++;
    pendingRef.current++;
    queueRef.current = queueRef.current.then(async () => {
      try {
        // Run the save first. (Writing `opts.onDone?.(await remote())` would skip the save whenever
        // onDone is missing, because optional calls don't evaluate their arguments.)
        const result = await remote();
        opts.onDone?.(result);
      } catch (e) {
        console.error("Save failed:", opts.error, e);
        opts.revert();
        showNotice(`${opts.error} ${e instanceof Error && e.message ? e.message : ""}`.trim());
      } finally {
        pendingRef.current--;
        if (pendingRef.current === 0) fetchAllData(pinRef.current); // quietly swap temporary ids for real ones
      }
    });
  };

  /* ---------------- Tasks ---------------- */

  const toggleTask = (task: TaskItem) => {
    const completed = !task.completed;
    const delta = completed ? task.points : -task.points;
    const date = today || localDate();
    const prevDate = task.lastCompletedDate;

    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, completed, lastCompletedDate: completed ? date : undefined } : t)));
    setKids((p) => p.map((k) => (k.name === task.assignee ? { ...k, stars: k.stars + delta } : k)));

    if (completed) {
      celebrate({ name: task.assignee, headline: "Awesome job!", title: task.title, points: task.points, icon: task.icon || "⭐", imageUrl: task.imageUrl });
    }
    if (!isLiveMode) return;

    save(() => hubPost({ action: "completeTask", taskId: resolveId(task.id), completed }), {
      error: "Couldn't save that change.",
      revert: () => {
        setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, completed: !completed, lastCompletedDate: prevDate } : t)));
        setKids((p) => p.map((k) => (k.name === task.assignee ? { ...k, stars: k.stars - delta } : k)));
        if (completed) setCelebration(null);
      },
    });
  };

  /** Moves a task within a kid's list or to another kid. Press-and-hold a task to use it. */
  const placeTask = (task: TaskItem, toKid: string, where: TaskPlacement) => {
    const moves = planTaskMove(tasks, task.id, toKid, where);
    if (!moves.length) return;
    const byId = new Map(moves.map((m) => [m.id, m]));
    const before = new Map(tasks.filter((t) => byId.has(t.id)).map((t) => [t.id, { priority: t.priority, assignee: t.assignee }]));

    setTasks((p) => p.map((t) => (byId.has(t.id) ? { ...t, priority: byId.get(t.id)!.priority, assignee: byId.get(t.id)!.assignee ?? t.assignee } : t)));
    if (toKid !== task.assignee) showNotice(`${task.title} moved to ${toKid}.`);
    if (!isLiveMode) return;

    save(() => hubPost({ action: "reorderTasks", items: moves.map((m) => ({ ...m, id: resolveId(m.id) })) }), {
      error: "Couldn't move that task.",
      revert: () => setTasks((p) => p.map((t) => (before.has(t.id) ? { ...t, ...before.get(t.id)! } : t))),
    });
  };

  const handleAddTask = (t: NewTask) => {
    setShowAddTask(false);
    const tempId = (isLiveMode ? "tmp-" : "demo-") + Date.now();
    // New tasks go to the bottom of that kid's list, both now and after the next sync.
    const priority = nextPriority(tasks, t.assignee);
    setTasks((p) => [...p, { ...t, id: tempId, completed: false, dueToday: true, priority }]);
    if (!isLiveMode) return;

    save(
      () =>
        hubPost({
          action: "create",
          table: "Tasks",
          fields: {
            Title: t.title,
            Assignee: t.assignee,
            Category: t.category,
            Points: t.points,
            Completed: false,
            Priority: priority,
            Repeat: t.repeat.charAt(0).toUpperCase() + t.repeat.slice(1),
            RepeatDays: t.repeatDays.join(","),
            ...(t.imageUrl ? { Image: [{ url: t.imageUrl }] } : {}),
            ...(t.icon ? { Icon: t.icon } : {}),
          },
        }),
      {
        error: "Couldn't add the task.",
        onDone: (r) => r.id && (idMapRef.current[tempId] = r.id),
        revert: () => setTasks((p) => p.filter((x) => x.id !== tempId)),
      }
    );
  };

  /* ---------------- Rewards ---------------- */

  const handleAddReward = (r: NewReward) => {
    setShowAddReward(false);
    const tempId = (isLiveMode ? "tmp-r" : "demo-r") + Date.now();
    setRewards((p) => [...p, { ...r, id: tempId }]);
    if (!isLiveMode) return;

    save(
      () =>
        hubPost({
          action: "create",
          table: "Rewards",
          fields: { Title: r.title, Cost: r.cost, Icon: r.icon, Combinable: r.combinable, ...(r.imageUrl ? { Image: [{ url: r.imageUrl }] } : {}) },
        }),
      {
        error: "Couldn't add the reward.",
        onDone: (res) => res.id && (idMapRef.current[tempId] = res.id),
        revert: () => setRewards((p) => p.filter((x) => x.id !== tempId)),
      }
    );
  };

  const deposit = (kid: Kid, reward: RewardItem, amount: number) => {
    const error = validateDeposit(kid, reward, contributions, amount);
    if (error) return showNotice(error);

    const fills = amount >= remainingCost(reward, contributions, kid.id);
    // Solo rewards are claimed per kid; shared rewards claim everyone's contributions together.
    const inJar = (c: { rewardId: string; kidId: string }) => c.rewardId === reward.id && (reward.combinable || c.kidId === kid.id);
    const jarBefore = contributions.filter(inJar);
    const names = kids.filter((k) => k.id === kid.id || jarBefore.some((c) => c.kidId === k.id)).map((k) => k.name);
    const party = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
    const prefix = isLiveMode ? "tmp-" : "demo-";
    const contribId = `${prefix}c${Date.now()}`;
    const redId = `${prefix}red${Date.now()}`;

    // 1. Update the screen right away.
    setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, stars: k.stars - amount } : k)));
    if (fills) {
      const jar = [...jarBefore, { kidId: kid.id, amount }];
      setContributions((p) => p.filter((c) => !inJar(c)));
      setRedemptions((p) => [
        {
          id: redId,
          reward: reward.title,
          kids: names.join(", "),
          details: jar.map((c) => `${kids.find((k) => k.id === c.kidId)?.name} ${c.amount}★`).join(", "),
          cost: reward.cost,
          date: today || localDate(),
          fulfilled: false,
        },
        ...p,
      ]);
      celebrate({ name: party, headline: "Reward unlocked!", title: reward.title, icon: reward.icon, imageUrl: reward.imageUrl });
    } else {
      setContributions((p) => [...p, { id: contribId, rewardId: reward.id, kidId: kid.id, amount }]);
      showNotice(`${kid.name} added ${amount}★ to ${reward.title}.`);
    }
    if (!isLiveMode) return;

    // 2. Save in the background; undo this one change if it fails.
    save(() => hubPost({ action: "deposit", rewardId: resolveId(reward.id), kidId: resolveId(kid.id), amount }), {
      error: "Couldn't add those stars.",
      onDone: (r) => {
        if (r.contributionId) idMapRef.current[contribId] = r.contributionId;
        if (r.redemptionId) idMapRef.current[redId] = r.redemptionId;
      },
      revert: () => {
        setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, stars: k.stars + amount } : k)));
        if (fills) {
          setContributions((p) => [...p, ...jarBefore]);
          setRedemptions((p) => p.filter((x) => x.id !== redId));
          setCelebration(null);
        } else {
          setContributions((p) => p.filter((c) => c.id !== contribId));
        }
      },
    });
  };

  const fulfill = (r: Redemption) => {
    setRedemptions((p) => p.map((x) => (x.id === r.id ? { ...x, fulfilled: true } : x)));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "update", table: "Redemptions", recordId: resolveId(r.id), fields: { Fulfilled: true } }), {
      error: "Couldn't save that change.",
      revert: () => setRedemptions((p) => p.map((x) => (x.id === r.id ? { ...x, fulfilled: false } : x))),
    });
  };

  const withdraw = (c: Contribution) => {
    setContributions((p) => p.filter((x) => x.id !== c.id));
    setKids((p) => p.map((k) => (k.id === c.kidId ? { ...k, stars: k.stars + c.amount } : k)));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "withdraw", contributionId: resolveId(c.id) }), {
      error: "Couldn't take those stars back.",
      revert: () => {
        setContributions((p) => [...p, c]);
        setKids((p) => p.map((k) => (k.id === c.kidId ? { ...k, stars: k.stars - c.amount } : k)));
      },
    });
  };

  /* ---------------- Family members ---------------- */

  const addKid = async (k: { name: string; color: string; photo?: string }) => {
    const tempId = (isLiveMode ? "tmp-k" : "demo-k") + Date.now();
    setKids((p) => [...p, { id: tempId, name: k.name, color: k.color, photo: k.photo, stars: 0 }]);
    if (!isLiveMode) return;
    save(
      () =>
        hubPost({
          action: "create",
          table: "Kids",
          fields: { Name: k.name, Color: k.color, Stars: 0, Order: kids.length + 1, ...(k.photo ? { Photo: k.photo } : {}) },
        }),
      {
        error: "Couldn't add that person.",
        onDone: (r) => r.id && (idMapRef.current[tempId] = r.id),
        revert: () => setKids((p) => p.filter((x) => x.id !== tempId)),
      }
    );
  };

  const setKidPhoto = async (kid: Kid, photo: string) => {
    const prev = kid.photo;
    setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, photo } : k)));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "update", table: "Kids", recordId: resolveId(kid.id), fields: { Photo: photo } }), {
      error: "Couldn't save that photo.",
      revert: () => setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, photo: prev } : k))),
    });
  };

  const setKidColor = async (kid: Kid, color: string) => {
    const prev = kid.color;
    setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, color } : k)));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "update", table: "Kids", recordId: resolveId(kid.id), fields: { Color: color } }), {
      error: "Couldn't save that color.",
      revert: () => setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, color: prev } : k))),
    });
  };

  const moveKid = async (kid: Kid, dir: -1 | 1) => {
    const i = kids.findIndex((k) => k.id === kid.id);
    const j = i + dir;
    if (j < 0 || j >= kids.length) return;
    const swap = (list: Kid[], a: string, b: string) => {
      const next = [...list];
      const x = next.findIndex((k) => k.id === a);
      const y = next.findIndex((k) => k.id === b);
      if (x < 0 || y < 0) return list;
      [next[x], next[y]] = [next[y], next[x]];
      return next;
    };
    const otherId = kids[j].id;
    const nextOrder = swap(kids, kid.id, otherId);
    setKids(nextOrder);
    if (!isLiveMode) return;
    // Write the full order so every kid has an Order value.
    save(() => Promise.all(nextOrder.map((k, n) => hubPost({ action: "update", table: "Kids", recordId: resolveId(k.id), fields: { Order: n + 1 } }))), {
      error: "Couldn't save the new order.",
      revert: () => setKids((p) => swap(p, kid.id, otherId)),
    });
  };

  const removeKid = async (kid: Kid) => {
    const index = kids.findIndex((k) => k.id === kid.id);
    setKids((p) => p.filter((k) => k.id !== kid.id));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "delete", table: "Kids", recordId: resolveId(kid.id) }), {
      error: "Couldn't remove that person.",
      revert: () =>
        setKids((p) => {
          const next = [...p];
          next.splice(Math.min(index, next.length), 0, kid);
          return next;
        }),
    });
  };

  /* ---------------- Meals ---------------- */

  /** Saves one or many days of meals. An all-blank day removes that day's meals. */
  const saveMealDays = (items: MealDay[]) => {
    setEditMealDate(null);
    setPlanMonth(null);
    const dates = new Set(items.map((i) => i.date));
    const affected = (m: MealItem) => !!m.date && dates.has(m.date);
    const previous = meals.filter(affected);
    const isEmpty = (i: MealDay) => !i.breakfast.trim() && !i.lunch.trim() && !i.dinner.trim();
    const idPrefix = isLiveMode ? "tmp-m-" : "demo-m-";

    setMeals((p) => [
      ...p.filter((m) => !affected(m)),
      ...items
        .filter((i) => !isEmpty(i))
        .map((i) => ({
          id: previous.find((m) => m.date === i.date)?.id ?? idPrefix + i.date,
          date: i.date,
          day: "",
          breakfast: i.breakfast.trim(),
          lunch: i.lunch.trim(),
          dinner: i.dinner.trim(),
        })),
    ]);
    if (!isLiveMode) return;

    save(
      () =>
        hubPost({
          action: "saveMeals",
          items: items.map((i) => {
            const old = previous.find((m) => m.date === i.date);
            return { ...i, id: old ? resolveId(old.id) : undefined };
          }),
        }),
      {
        error: "Couldn't save the meals.",
        onDone: (r) => Object.entries(r.created || {}).forEach(([date, id]) => (idMapRef.current[idPrefix + date] = id)),
        revert: () => setMeals((p) => [...p.filter((m) => !affected(m)), ...previous]),
      }
    );
  };

  /* ---------------- Shopping ---------------- */

  const handleAddShopping = (e: React.FormEvent) => {
    e.preventDefault();
    const item = newShoppingItem.trim();
    if (!item) return;
    setNewShoppingItem("");
    const tempId = (isLiveMode ? "tmp-s" : "s-") + Date.now();
    setShopping((p) => [{ id: tempId, item, category: "Grocery", checked: false }, ...p]);
    if (!isLiveMode) return;
    save(() => hubPost({ action: "create", table: "Shopping", fields: { Item: item, Category: "Grocery", Checked: false } }), {
      error: "Couldn't add the item.",
      onDone: (r) => r.id && (idMapRef.current[tempId] = r.id),
      revert: () => setShopping((p) => p.filter((x) => x.id !== tempId)),
    });
  };

  const toggleShoppingItem = (item: ShoppingItem) => {
    const checked = !item.checked;
    setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, checked } : s)));
    if (!isLiveMode) return;
    save(() => hubPost({ action: "update", table: "Shopping", recordId: resolveId(item.id), fields: { Checked: checked } }), {
      error: "Couldn't save that change.",
      revert: () => setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, checked: !checked } : s))),
    });
  };

  const todaysMeal = mealFor(meals, today);
  const sleeping = sleep.enabled && nowMs >= awakeUntil && inSleepWindow(sleep.sleepAt, sleep.wakeAt, new Date(nowMs));
  const currentTemp = weather?.current_weather?.temperature ? `${Math.round(weather.current_weather.temperature)}°F` : "";

  return (
    <div
      onClick={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      className="app-shell relative flex w-screen select-none flex-col overflow-hidden bg-sky-50 px-3 pt-3 text-slate-800"
    >
      {screensaverActive && (
        <PhotoFrame photos={photos} time={currentTime} date={currentDate} temp={currentTemp} onClose={() => setScreensaverActive(false)} />
      )}

      {sleeping && <SleepScreen onWake={() => setAwakeUntil(Date.now() + 5 * 60 * 1000)} />}

      {celebration && <Celebration data={celebration} onClose={closeCelebration} />}

      {notice && (
        <div className="pointer-events-none fixed left-0 right-0 top-4 z-[70] flex justify-center">
          <div className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xl">{notice}</div>
        </div>
      )}

      {/* Header */}
      <header className="mb-3 flex shrink-0 items-center justify-between rounded-2xl bg-white shadow-sm px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPinModal(true)}
            className={`rounded-xl p-2 ${isLiveMode ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}
            title={isLiveMode ? "Live family mode" : "Demo mode — tap to enter PIN"}
          >
            {isLiveMode ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{isLiveMode ? "Family Hub" : "Family Hub (Demo)"}</h1>
            <p className="text-xs text-slate-500">{currentDate}</p>
          </div>
        </div>

        <button onClick={() => setActiveTab("meals")} className="flex items-center gap-2 rounded-xl bg-sky-50 px-3.5 py-1.5">
          <Utensils className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-slate-500">Dinner</span>
          <span className="text-sm font-semibold text-slate-800">{todaysMeal?.dinner || "Tap to plan"}</span>
        </button>

        <div className="flex items-center gap-4">
          {currentTemp && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-600">
              <CloudSun className="h-5 w-5" />
              {currentTemp}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScreensaverActive(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-medium text-slate-700 active:bg-sky-200">
            <ImageIcon className="h-4 w-4 text-pink-600" /> Photos
          </button>
          <button onClick={() => setShowSettings(true)} aria-label="Settings" className="rounded-xl bg-sky-100 p-2 text-slate-700 active:bg-sky-200">
            <Settings className="h-5 w-5" />
          </button>
          <div className="text-xl font-bold tabular-nums text-slate-800">{currentTime}</div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "tasks" && <TasksTab kids={kids} tasks={tasks} onToggle={toggleTask} onPlace={placeTask} />}
        {activeTab === "calendar" && <CalendarTab events={events} weather={weather} />}
        {activeTab === "rewards" && (
          <RewardsTab
            kids={kids}
            rewards={rewards}
            contributions={contributions}
            onDeposit={deposit}
            onWithdraw={withdraw}
            onAddReward={() => setShowAddReward(true)}
            redemptions={redemptions}
            onFulfill={fulfill}
          />
        )}
        {activeTab === "meals" && <MealsTab meals={meals} today={today} onEditDay={setEditMealDate} onPlan={setPlanMonth} />}
        {activeTab === "shopping" && (
          <ShoppingTab items={shopping} newItem={newShoppingItem} setNewItem={setNewShoppingItem} onAdd={handleAddShopping} onToggle={toggleShoppingItem} />
        )}
      </main>

      {/* Bottom dock */}
      <footer className="dock mb-8 mt-3 flex shrink-0 items-center justify-between rounded-2xl bg-white shadow-sm px-3 py-2">
        <nav className="flex items-center gap-1.5">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  active ? "bg-indigo-500 text-white shadow-lg" : "text-slate-600 active:bg-sky-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 active:scale-95">
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </footer>

      {showAddTask && <AddTaskModal kids={kids} pin={pin} onSave={handleAddTask} onClose={() => setShowAddTask(false)} />}
      {editMealDate && <MealEditor date={editMealDate} meals={meals} onSave={(d) => saveMealDays([d])} onClose={() => setEditMealDate(null)} />}
      {planMonth && <MealPlanner month={planMonth} meals={meals} onSave={saveMealDays} onClose={() => setPlanMonth(null)} />}
      {showAddReward && <AddRewardModal pin={pin} onSave={handleAddReward} onClose={() => setShowAddReward(false)} />}
      {showKids && (
        <KidsManager
          kids={kids}
          contributions={contributions}
          onAdd={addKid}
          onPhoto={setKidPhoto}
          onMove={moveKid}
          onColor={setKidColor}
          onRemove={removeKid}
          onClose={() => setShowKids(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          value={sleep}
          onManageKids={() => {
            setShowSettings(false);
            setShowKids(true);
          }}
          onClose={() => setShowSettings(false)}
          onSave={(v) => {
            setSleep(v);
            try {
              localStorage.setItem("family_hub_sleep", JSON.stringify(v));
            } catch {
              // storage unavailable; setting lasts until reload
            }
            setShowSettings(false);
          }}
        />
      )}
      {showPinModal && (
        <PinModal
          onClose={() => setShowPinModal(false)}
          onSave={(value) => {
            localStorage.setItem("family_hub_pin", value);
            setPin(value);
            pinRef.current = value;
            setShowPinModal(false);
            fetchAllData(value);
          }}
        />
      )}
    </div>
  );
}
