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
import { CalendarTab, MealsTab, ShoppingTab } from "@/components/OtherTabs";
import { AddRewardModal, AddTaskModal, NewReward, NewTask, PinModal } from "@/components/Modals";
import { DEMO_CONTRIBUTIONS, DEMO_KIDS, DEMO_MEALS, DEMO_REWARDS, DEMO_SHOPPING, DEMO_TASKS } from "@/lib/demoData";
import { inSleepWindow, remainingCost, todayIn, validateDeposit } from "@/lib/rules";
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
  const [todayName, setTodayName] = useState("");
  const [today, setToday] = useState("");

  const pinRef = useRef("");
  pinRef.current = pin;

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
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
    return data as { claimed?: boolean };
  }, []);

  const fetchAllData = useCallback(async (activePin: string) => {
    try {
      const headers = { "x-family-pin": activePin };
      const [hubRes, extRes] = await Promise.all([fetch("/api/hub", { headers }), fetch("/api/external", { headers })]);

      if (hubRes.ok) {
        const hub = await hubRes.json();
        setIsLiveMode(true);
        if (hub.kids?.length) setKids(hub.kids);
        if (hub.tasks) setTasks(hub.tasks);
        if (hub.rewards) setRewards(hub.rewards);
        if (hub.contributions) setContributions(hub.contributions);
        if (hub.meals?.length) setMeals(hub.meals);
        if (hub.shopping) setShopping(hub.shopping);
        if (hub.redemptions) setRedemptions(hub.redemptions);
        if (hub.timeZone) setTimeZone(hub.timeZone);
      } else {
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
      setTodayName(now.toLocaleDateString("en-US", { weekday: "long", ...tz }));
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

  /* ---------------- Tasks ---------------- */

  const toggleTask = async (task: TaskItem) => {
    const completed = !task.completed;
    const delta = completed ? task.points : -task.points;
    const date = today || localDate();

    const prevTasks = tasks;
    const prevKids = kids;
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, completed, lastCompletedDate: completed ? date : undefined } : t)));
    setKids((p) => p.map((k) => (k.name === task.assignee ? { ...k, stars: k.stars + delta } : k)));

    if (completed) {
      celebrate({
        name: task.assignee,
        headline: "Awesome job!",
        title: task.title,
        points: task.points,
        icon: "⭐",
        imageUrl: task.imageUrl,
      });
    }

    if (isLiveMode) {
      try {
        await hubPost({ action: "completeTask", taskId: task.id, completed });
        fetchAllData(pinRef.current);
      } catch (e) {
        setTasks(prevTasks);
        setKids(prevKids);
        showNotice(e instanceof Error ? e.message : "Couldn't save that change.");
      }
    }
  };

  const handleAddTask = async (t: NewTask) => {
    setShowAddTask(false);
    if (!isLiveMode) {
      setTasks((p) => [...p, { ...t, id: "demo-" + Date.now(), completed: false, dueToday: true }]);
      return;
    }
    try {
      await hubPost({
        action: "create",
        table: "Tasks",
        fields: {
          Title: t.title,
          Assignee: t.assignee,
          Category: t.category,
          Points: t.points,
          Completed: false,
          Repeat: t.repeat.charAt(0).toUpperCase() + t.repeat.slice(1),
          RepeatDays: t.repeatDays.join(","),
          ...(t.imageUrl ? { ImageUrl: t.imageUrl } : {}),
        },
      });
      fetchAllData(pinRef.current);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Couldn't add the task.");
    }
  };

  /* ---------------- Rewards ---------------- */

  const handleAddReward = async (r: NewReward) => {
    setShowAddReward(false);
    if (!isLiveMode) {
      setRewards((p) => [...p, { ...r, id: "demo-r" + Date.now() }]);
      return;
    }
    try {
      await hubPost({
        action: "create",
        table: "Rewards",
        fields: { Title: r.title, Cost: r.cost, Icon: r.icon, Combinable: r.combinable, ...(r.imageUrl ? { ImageUrl: r.imageUrl } : {}) },
      });
      fetchAllData(pinRef.current);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Couldn't add the reward.");
    }
  };

  const deposit = async (kid: Kid, reward: RewardItem, amount: number) => {
    const error = validateDeposit(kid, reward, contributions, amount);
    if (error) return showNotice(error);

    const fills = amount >= remainingCost(reward, contributions);
    const contributorIds = new Set(contributions.filter((c) => c.rewardId === reward.id).map((c) => c.kidId));
    contributorIds.add(kid.id);
    const names = kids.filter((k) => contributorIds.has(k.id)).map((k) => k.name);
    const party = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);

    const claimedData: CelebrationData = {
      name: party,
      headline: "Reward unlocked!",
      title: reward.title,
      icon: reward.icon,
      imageUrl: reward.imageUrl,
    };

    if (!isLiveMode) {
      setKids((p) => p.map((k) => (k.id === kid.id ? { ...k, stars: k.stars - amount } : k)));
      setContributions((p) =>
        fills
          ? p.filter((c) => c.rewardId !== reward.id)
          : [...p, { id: "demo-c" + Date.now(), rewardId: reward.id, kidId: kid.id, amount }]
      );
      if (fills) {
        const jar = [...contributions.filter((c) => c.rewardId === reward.id), { kidId: kid.id, amount }];
        setRedemptions((p) => [
          {
            id: "demo-red" + Date.now(),
            reward: reward.title,
            kids: names.join(", "),
            details: jar.map((c) => `${kids.find((k) => k.id === c.kidId)?.name} ${c.amount}★`).join(", "),
            cost: reward.cost,
            date: today || localDate(),
            fulfilled: false,
          },
          ...p,
        ]);
        celebrate(claimedData);
      } else showNotice(`${kid.name} added ${amount}★ to ${reward.title}.`);
      return;
    }

    try {
      const result = await hubPost({ action: "deposit", rewardId: reward.id, kidId: kid.id, amount });
      if (result.claimed) celebrate(claimedData);
      else showNotice(`${kid.name} added ${amount}★ to ${reward.title}.`);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Couldn't add those stars.");
    }
    fetchAllData(pinRef.current);
  };

  const fulfill = async (r: Redemption) => {
    setRedemptions((p) => p.map((x) => (x.id === r.id ? { ...x, fulfilled: true } : x)));
    if (!isLiveMode) return;
    try {
      await hubPost({ action: "update", table: "Redemptions", recordId: r.id, fields: { Fulfilled: true } });
    } catch (e) {
      setRedemptions((p) => p.map((x) => (x.id === r.id ? { ...x, fulfilled: false } : x)));
      showNotice(e instanceof Error ? e.message : "Couldn't save that change.");
    }
  };

  const withdraw = async (c: Contribution) => {
    if (!isLiveMode) {
      setContributions((p) => p.filter((x) => x.id !== c.id));
      setKids((p) => p.map((k) => (k.id === c.kidId ? { ...k, stars: k.stars + c.amount } : k)));
      return;
    }
    try {
      await hubPost({ action: "withdraw", contributionId: c.id });
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Couldn't take those stars back.");
    }
    fetchAllData(pinRef.current);
  };

  /* ---------------- Shopping ---------------- */

  const handleAddShopping = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = newShoppingItem.trim();
    if (!item) return;
    setNewShoppingItem("");
    if (!isLiveMode) {
      setShopping((p) => [{ id: "s-" + Date.now(), item, category: "Grocery", checked: false }, ...p]);
      return;
    }
    try {
      await hubPost({ action: "create", table: "Shopping", fields: { Item: item, Category: "Grocery", Checked: false } });
      fetchAllData(pinRef.current);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Couldn't add the item.");
    }
  };

  const toggleShoppingItem = async (item: ShoppingItem) => {
    const checked = !item.checked;
    setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, checked } : s)));
    if (!isLiveMode) return;
    try {
      await hubPost({ action: "update", table: "Shopping", recordId: item.id, fields: { Checked: checked } });
    } catch (e) {
      setShopping((p) => p.map((s) => (s.id === item.id ? { ...s, checked: !checked } : s)));
      showNotice(e instanceof Error ? e.message : "Couldn't save that change.");
    }
  };

  const todaysMeal = meals.find((m) => m.day.toLowerCase() === todayName.toLowerCase()) || meals[0];
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
        {activeTab === "tasks" && <TasksTab kids={kids} tasks={tasks} onToggle={toggleTask} />}
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
        {activeTab === "meals" && <MealsTab meals={meals} todayName={todayName} />}
        {activeTab === "shopping" && (
          <ShoppingTab items={shopping} newItem={newShoppingItem} setNewItem={setNewShoppingItem} onAdd={handleAddShopping} onToggle={toggleShoppingItem} />
        )}
      </main>

      {/* Bottom dock */}
      <footer className="mb-8 mt-3 flex shrink-0 items-center justify-between rounded-2xl bg-white shadow-sm px-3 py-2">
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

      {showAddTask && <AddTaskModal kids={kids} onSave={handleAddTask} onClose={() => setShowAddTask(false)} />}
      {showAddReward && <AddRewardModal onSave={handleAddReward} onClose={() => setShowAddReward(false)} />}
      {showSettings && (
        <SettingsModal
          value={sleep}
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
