"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Star,
  Utensils,
  Calendar as CalendarIcon,
  RotateCcw,
  BookOpen,
  Sparkles,
  Trophy,
  ShoppingCart,
  Image as ImageIcon,
  Plus,
  Lock,
  Unlock,
  CloudSun,
  Trash2,
  X,
} from "lucide-react";

// --- DEMO FALLBACK DATA (Shown to public portfolio visitors without PIN) ---
const DEMO_KIDS = [
  { id: "k1", name: "Alex", stars: 14, color: "blue" },
  { id: "k2", name: "Sam", stars: 11, color: "emerald" },
  { id: "k3", name: "Jordan", stars: 9, color: "amber" },
  { id: "k4", name: "Taylor", stars: 7, color: "purple" },
];

const DEMO_TASKS = [
  { id: "t1", title: "Math Lesson", assignee: "Alex", category: "school", points: 2, completed: false },
  { id: "t2", title: "Reading (20 mins)", assignee: "Alex", category: "school", points: 1, completed: false },
  { id: "t3", title: "Make Bed & Tidy Room", assignee: "Alex", category: "chore", points: 1, completed: false },
  { id: "t4", title: "Phonics & Spelling", assignee: "Sam", category: "school", points: 2, completed: false },
  { id: "t5", title: "Feed Backyard Chickens", assignee: "Sam", category: "chore", points: 2, completed: false },
  { id: "t6", title: "Science Experiment", assignee: "Jordan", category: "school", points: 2, completed: false },
  { id: "t7", title: "Clear Dinner Dishes", assignee: "Jordan", category: "chore", points: 1, completed: false },
  { id: "t8", title: "Colors & Numbers", assignee: "Taylor", category: "school", points: 1, completed: false },
  { id: "t9", title: "Put Toys in Bin", assignee: "Taylor", category: "chore", points: 1, completed: false },
];

const DEMO_REWARDS = [
  { id: "r1", title: "30 Mins Screen Time", cost: 10, icon: "🎮" },
  { id: "r2", title: "Ice Cream Sundae Night", cost: 20, icon: "🍨" },
  { id: "r3", title: "Pick Friday Family Movie", cost: 25, icon: "🍿" },
  { id: "r4", title: "Stay Up 30 Mins Late", cost: 15, icon: "🌙" },
  { id: "r5", title: "Special Trip with Dad", cost: 40, icon: "🥏" },
];

const DEMO_MEALS = [
  { id: "m1", day: "Monday", breakfast: "Oatmeal & Berries", lunch: "Turkey Wraps", dinner: "Taco Night" },
  { id: "m2", day: "Tuesday", breakfast: "Scrambled Eggs", lunch: "Quesadillas", dinner: "Baked Ziti & Salad" },
  { id: "m3", day: "Wednesday", breakfast: "Fresh Milled Pancakes", lunch: "Leftovers", dinner: "Slow Cooker Roast" },
  { id: "m4", day: "Thursday", breakfast: "Yogurt & Granola", lunch: "Grilled Cheese", dinner: "Teriyaki Chicken Bowls" },
  { id: "m5", day: "Friday", breakfast: "Bagels & Cream Cheese", lunch: "Picnic at the Park", dinner: "Homemade Pizza Night" },
  { id: "m6", day: "Saturday", breakfast: "Waffles & Bacon", lunch: "Sandwiches", dinner: "Burgers on the Grill" },
  { id: "m7", day: "Sunday", breakfast: "Cinnamon Rolls", lunch: "Sunday Roast", dinner: "Soup & Fresh Bread" },
];

const DEMO_SHOPPING = [
  { id: "s1", item: "Whole Wheat Berries", category: "Pantry", checked: false },
  { id: "s2", item: "Raw Milk & Heavy Cream", category: "Dairy", checked: false },
  { id: "s3", item: "Apples & Bananas", category: "Produce", checked: false },
  { id: "s4", item: "Mozzarella Cheese", category: "Dairy", checked: true },
];

const COLOR_MAP: Record<string, { text: string; bg: string; border: string; badge: string }> = {
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", badge: "bg-blue-500" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "bg-emerald-500" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", badge: "bg-amber-500" },
  purple: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", badge: "bg-purple-500" },
};

// Web Audio API victory fanfare (Zero external audio files needed, works on iOS 15)
function playVictorySound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.11 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.11);
      osc.stop(ctx.currentTime + idx * 0.11 + 0.35);
    });
  } catch (e) {
    // Ignore audio errors if muted
  }
}

export default function FamilyWallPlanner() {
  const [activeTab, setActiveTab] = useState<"tasks" | "calendar" | "rewards" | "meals" | "shopping">("tasks");
  const [pin, setPin] = useState<string>("");
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");

  // App State
  const [kids, setKids] = useState<any[]>(DEMO_KIDS);
  const [tasks, setTasks] = useState<any[]>(DEMO_TASKS);
  const [rewards, setRewards] = useState<any[]>(DEMO_REWARDS);
  const [meals, setMeals] = useState<any[]>(DEMO_MEALS);
  const [shopping, setShopping] = useState<any[]>(DEMO_SHOPPING);
  const [events, setEvents] = useState<any[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [weather, setWeather] = useState<any>(null);

  // Modals & Overlays
  const [celebration, setCelebration] = useState<{ name: string; title: string; points: number; icon: string } | null>(null);
  const [showAddTask, setShowAddTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<"school" | "chore">("school");
  const [newTaskPoints, setNewTaskPoints] = useState(1);
  const [newShoppingItem, setNewShoppingItem] = useState("");

  // Screensaver State
  const [screensaverActive, setScreensaverActive] = useState<boolean>(false);
  const [photoIndex, setPhotoIndex] = useState<number>(0);
  const idleTimerRef = useRef<any>(null);

  // Clock
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [todayName, setTodayName] = useState<string>("Wednesday");

  // Load PIN and Fetch Data
  useEffect(() => {
    const savedPin = localStorage.getItem("family_hub_pin") || "";
    setPin(savedPin);
    fetchAllData(savedPin);
    const syncTimer = setInterval(() => fetchAllData(savedPin), 60000);
    return () => clearInterval(syncTimer);
  }, []);

  async function fetchAllData(activePin: string) {
    try {
      const headers = { "x-family-pin": activePin };
      const [hubRes, extRes] = await Promise.all([
        fetch("/api/hub", { headers }),
        fetch("/api/external", { headers }),
      ]);

      if (hubRes.ok) {
        const hubData = await hubRes.json();
        setIsLiveMode(true);
        if (hubData.kids?.length) setKids(hubData.kids);
        if (hubData.tasks) setTasks(hubData.tasks);
        if (hubData.rewards?.length) setRewards(hubData.rewards);
        if (hubData.meals?.length) setMeals(hubData.meals);
        if (hubData.shopping) setShopping(hubData.shopping);
      } else {
        setIsLiveMode(false);
      }

      if (extRes.ok) {
        const extData = await extRes.json();
        if (extData.weather) setWeather(extData.weather);
        if (extData.events) setEvents(extData.events);
        if (extData.photos?.length) setPhotos(extData.photos);
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  }

  // Clock Updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
      setTodayName(now.toLocaleDateString("en-US", { weekday: "long" }));
    };
    updateClock();
    const t = setInterval(updateClock, 10000);
    return () => clearInterval(t);
  }, []);

  // Idle Timer for Photo Screensaver (3 minutes of no touch)
  const resetIdleTimer = () => {
    if (screensaverActive) setScreensaverActive(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setScreensaverActive(true);
    }, 180000);
  };

  useEffect(() => {
    resetIdleTimer();
    return () => clearTimeout(idleTimerRef.current);
  }, []);

  // Rotate Screensaver Photo every 12 seconds
  useEffect(() => {
    if (!screensaverActive || photos.length === 0) return;
    const interval = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [screensaverActive, photos]);

  // --- ACTIONS ---
  const triggerCelebration = (name: string, title: string, points: number, icon = "🌟") => {
    playVictorySound();
    setCelebration({ name, title, points, icon });
    setTimeout(() => setCelebration(null), 3200);
  };

  const toggleTask = async (task: any) => {
    const nextState = !task.completed;
    const pointDelta = nextState ? task.points : -task.points;

    // Optimistic UI update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextState } : t)));
    const targetKid = kids.find((k) => k.name === task.assignee);
    const newStarCount = targetKid ? Math.max(0, targetKid.stars + pointDelta) : 0;

    setKids((prev) =>
      prev.map((k) => (k.name === task.assignee ? { ...k, stars: newStarCount } : k))
    );

    if (nextState) {
      triggerCelebration(task.assignee, task.title, task.points, "⭐");
    }

    if (isLiveMode) {
      await fetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-family-pin": pin },
        body: JSON.stringify({
          action: "update",
          table: "Tasks",
          recordId: task.id,
          fields: { Completed: nextState },
        }),
      });
      if (targetKid) {
        await fetch("/api/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-family-pin": pin },
          body: JSON.stringify({
            action: "update",
            table: "Kids",
            recordId: targetKid.id,
            fields: { Stars: newStarCount },
          }),
        });
      }
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const assignee = newTaskAssignee || kids[0]?.name || "Alex";

    const tempTask = {
      id: "temp-" + Date.now(),
      title: newTaskTitle,
      assignee,
      category: newTaskCategory,
      points: Number(newTaskPoints),
      completed: false,
    };

    setTasks((prev) => [...prev, tempTask]);
    setNewTaskTitle("");
    setShowAddTask(false);

    if (isLiveMode) {
      await fetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-family-pin": pin },
        body: JSON.stringify({
          action: "create",
          table: "Tasks",
          fields: {
            Title: tempTask.title,
            Assignee: tempTask.assignee,
            Category: tempTask.category,
            Points: tempTask.points,
            Completed: false,
          },
        }),
      });
      fetchAllData(pin);
    }
  };

  const redeemReward = async (kid: any, reward: any) => {
    if (kid.stars < reward.cost) return;
    const updatedStars = kid.stars - reward.cost;

    setKids((prev) => prev.map((k) => (k.id === kid.id ? { ...k, stars: updatedStars } : k)));
    triggerCelebration(kid.name, `Redeemed: ${reward.title}!`, reward.cost, reward.icon);

    if (isLiveMode) {
      await fetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-family-pin": pin },
        body: JSON.stringify({
          action: "update",
          table: "Kids",
          recordId: kid.id,
          fields: { Stars: updatedStars },
        }),
      });
    }
  };

  const handleAddShopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShoppingItem.trim()) return;
    const temp = { id: "s-" + Date.now(), item: newShoppingItem, category: "Grocery", checked: false };
    setShopping((prev) => [temp, ...prev]);
    setNewShoppingItem("");

    if (isLiveMode) {
      await fetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-family-pin": pin },
        body: JSON.stringify({
          action: "create",
          table: "Shopping",
          fields: { Item: temp.item, Category: "Grocery", Checked: false },
        }),
      });
      fetchAllData(pin);
    }
  };

  const toggleShoppingItem = async (item: any) => {
    const nextState = !item.checked;
    setShopping((prev) => prev.map((s) => (s.id === item.id ? { ...s, checked: nextState } : s)));
    if (isLiveMode) {
      await fetch("/api/hub", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-family-pin": pin },
        body: JSON.stringify({
          action: "update",
          table: "Shopping",
          recordId: item.id,
          fields: { Checked: nextState },
        }),
      });
    }
  };

  const todaysMeal = meals.find((m) => m.day.toLowerCase() === todayName.toLowerCase()) || meals[0];
  const currentTemp = weather?.current_weather?.temperature
    ? `${Math.round(weather.current_weather.temperature)}°F`
    : "72°F";

  return (
    <div
      onClick={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      className="relative flex flex-col h-screen w-screen bg-slate-900 text-slate-100 p-3 select-none overflow-hidden"
    >
      {/* --- GOOGLE PHOTOS DIGITAL FRAME SCREENSAVER --- */}
      {screensaverActive && (
        <div
          onClick={() => setScreensaverActive(false)}
          className="fixed inset-0 z-50 bg-black flex items-end justify-between p-10 cursor-pointer"
        >
          {photos.length > 0 && (
            <img
              src={photos[photoIndex]}
              alt="Family Memory"
              className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-1000"
            />
          )}
          <div className="relative z-10 bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/15">
            <div className="text-5xl font-bold text-white tracking-tight">{currentTime}</div>
            <div className="text-lg text-slate-200 mt-1">{currentDate} • {currentTemp}</div>
          </div>
          <div className="relative z-10 bg-black/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-sm text-slate-300">
            Tap anywhere to open Family Hub
          </div>
        </div>
      )}

      {/* --- GIANT CELEBRATION OVERLAY --- */}
      {celebration && (
        <div
          onClick={() => setCelebration(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center bg-gradient-to-b from-indigo-900 to-slate-900 border-2 border-amber-400 rounded-3xl p-10 shadow-2xl transform scale-105 text-center max-w-md">
            <div className="text-8xl mb-4 animate-bounce">{celebration.icon}</div>
            <h2 className="text-3xl font-extrabold text-amber-300 tracking-wide">
              AWESOME JOB, {celebration.name.toUpperCase()}!
            </h2>
            <p className="text-lg text-slate-200 mt-2 font-medium">{celebration.title}</p>
            <div className="mt-5 inline-flex items-center space-x-2 bg-amber-400/20 border border-amber-400 px-6 py-2 rounded-full">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              <span className="text-xl font-bold text-amber-300">+{celebration.points} Stars!</span>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP HEADER BAR --- */}
      <header className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-2xl px-4 py-2.5 mb-3 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPinModal(true)}
            className={`p-2 rounded-xl border ${
              isLiveMode
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/40 text-amber-400"
            }`}
            title={isLiveMode ? "Live Family Mode" : "Portfolio Demo Mode (Tap to enter PIN)"}
          >
            {isLiveMode ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {isLiveMode ? "Loosle Family Hub" : "Family Hub (Demo)"}
            </h1>
            <p className="text-xs text-slate-400">{currentDate}</p>
          </div>
        </div>

        {/* Today's Dinner Pill */}
        <div
          onClick={() => setActiveTab("meals")}
          className="flex items-center space-x-2 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer"
        >
          <Utensils className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400">Dinner:</span>
          <span className="text-xs font-semibold text-slate-100">
            {todaysMeal?.dinner || "Tap to plan"}
          </span>
        </div>

        {/* Weather + Photo Frame Trigger + Clock */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-sm font-medium text-sky-300">
            <CloudSun className="w-5 h-5" />
            <span>{currentTemp}</span>
          </div>

          <button
            onClick={() => setScreensaverActive(true)}
            className="flex items-center space-x-1 bg-slate-700/70 active:bg-slate-600 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200"
          >
            <ImageIcon className="w-4 h-4 text-pink-400" />
            <span>Photo Frame</span>
          </button>

          <div className="text-xl font-bold text-white tabular-nums">{currentTime}</div>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {/* TAB 1: CHORES & HOMESCHOOL */}
        {activeTab === "tasks" && (
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">
              {kids.map((kid) => {
                const style = COLOR_MAP[kid.color] || COLOR_MAP.blue;
                const kidTasks = tasks.filter((t) => t.assignee === kid.name);
                const doneCount = kidTasks.filter((t) => t.completed).length;
                const pct = kidTasks.length ? Math.round((doneCount / kidTasks.length) * 100) : 0;

                return (
                  <div
                    key={kid.id}
                    className={`flex flex-col rounded-2xl border ${style.border} bg-slate-800/50 p-3 overflow-hidden`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h2 className={`text-lg font-bold ${style.text}`}>{kid.name}</h2>
                      <div className="flex items-center space-x-1 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-amber-300">{kid.stars}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`${style.badge} h-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {kidTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => toggleTask(task)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            task.completed
                              ? "bg-slate-800/30 border-slate-700/40 opacity-50"
                              : `${style.bg} ${style.border} active:scale-95`
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            {task.completed ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-6 h-6 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <p
                                className={`text-sm font-medium leading-tight ${
                                  task.completed ? "line-through text-slate-400" : "text-slate-100"
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-slate-400">
                                  {task.category === "school" ? (
                                    <>
                                      <BookOpen className="w-3 h-3 mr-1 text-indigo-400" /> School
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-3 h-3 mr-1 text-amber-400" /> Chore
                                    </>
                                  )}
                                </span>
                                <span className="text-[10px] font-bold text-amber-400">
                                  +{task.points}★
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE CALENDAR & 3-DAY WEATHER */}
        {activeTab === "calendar" && (
          <div className="grid grid-cols-3 gap-4 h-full">
            <div className="col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-4 overflow-y-auto">
              <h2 className="text-lg font-bold text-indigo-400 mb-3">
                Upcoming Family Schedule (Synced with Google Calendar)
              </h2>
              <div className="space-y-2.5">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-400">No upcoming events found.</p>
                ) : (
                  events.map((ev) => {
                    const d = new Date(ev.start);
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between bg-slate-900/70 border border-slate-700/80 p-3 rounded-xl"
                      >
                        <div>
                          <p className="text-base font-bold text-white">{ev.title}</p>
                          {ev.location && (
                            <p className="text-xs text-slate-400 mt-0.5">{ev.location}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                            {d.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-sky-400 mb-3">3-Day Forecast</h2>
                <div className="space-y-3">
                  {weather?.daily?.time?.slice(0, 3).map((dayStr: string, idx: number) => (
                    <div
                      key={dayStr}
                      className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-700"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {idx === 0
                          ? "Today"
                          : new Date(dayStr + "T12:00:00").toLocaleDateString("en-US", {
                              weekday: "long",
                            })}
                      </span>
                      <span className="text-sm font-bold text-sky-300">
                        {Math.round(weather.daily.temperature_2m_max[idx])}° /{" "}
                        <span className="text-slate-400">
                          {Math.round(weather.daily.temperature_2m_min[idx])}°
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-200">
                Tip: Any event added to your or Dorothy&apos;s Google Calendar automatically appears here!
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REWARDS STORE */}
        {activeTab === "rewards" && (
          <div className="flex flex-col h-full bg-slate-800/50 border border-slate-700 rounded-2xl p-4 overflow-y-auto">
            <h2 className="text-lg font-bold text-amber-400 mb-3">
              Star Rewards Store — Tap a Kid&apos;s Name to Redeem!
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {rewards.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col justify-between bg-slate-900/80 border border-slate-700 rounded-2xl p-4"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-4xl">{r.icon}</span>
                    <div>
                      <h3 className="text-base font-bold text-white">{r.title}</h3>
                      <span className="text-xs font-bold text-amber-400">{r.cost} Stars</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {kids.map((k) => {
                      const canAfford = k.stars >= r.cost;
                      return (
                        <button
                          key={k.id}
                          disabled={!canAfford}
                          onClick={() => redeemReward(k, r)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                            canAfford
                              ? "bg-amber-500 text-slate-950 active:scale-95"
                              : "bg-slate-800 text-slate-500 opacity-50"
                          }`}
                        >
                          {k.name} ({k.stars}★)
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: WEEKLY MEAL PLANNER */}
        {activeTab === "meals" && (
          <div className="grid grid-cols-7 gap-2 h-full">
            {meals.map((m) => {
              const isToday = m.day.toLowerCase() === todayName.toLowerCase();
              return (
                <div
                  key={m.id}
                  className={`flex flex-col justify-between rounded-2xl border p-3 ${
                    isToday
                      ? "bg-emerald-500/10 border-emerald-400"
                      : "bg-slate-800/50 border-slate-700"
                  }`}
                >
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 mb-3">
                      {m.day}
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/70">
                        <span className="text-[10px] uppercase text-slate-400 block">Breakfast</span>
                        <p className="text-xs font-semibold text-white mt-0.5">{m.breakfast}</p>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/70">
                        <span className="text-[10px] uppercase text-slate-400 block">Lunch</span>
                        <p className="text-xs font-semibold text-white mt-0.5">{m.lunch}</p>
                      </div>
                      <div className="bg-slate-900/70 p-2.5 rounded-xl border border-emerald-500/30">
                        <span className="text-[10px] uppercase text-emerald-400 block">Dinner</span>
                        <p className="text-sm font-bold text-white mt-0.5">{m.dinner}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 5: SHOPPING & GROCERY LIST */}
        {activeTab === "shopping" && (
          <div className="grid grid-cols-3 gap-4 h-full">
            <div className="col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-4 overflow-y-auto">
              <h2 className="text-lg font-bold text-emerald-400 mb-3">Family Grocery & Supply List</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {shopping.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleShoppingItem(item)}
                    className={`flex items-center space-x-3 p-3 rounded-xl border text-left ${
                      item.checked
                        ? "bg-slate-900/30 border-slate-800 opacity-50 line-through"
                        : "bg-slate-900/80 border-slate-700"
                    }`}
                  >
                    {item.checked ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-white">{item.item}</span>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleAddShopping}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-bold text-white mb-2">Add to List</h3>
                <input
                  type="text"
                  value={newShoppingItem}
                  onChange={(e) => setNewShoppingItem(e.target.value)}
                  placeholder="e.g., Eggs, Butter, Apples..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3"
                />
                <button
                  type="submit"
                  className="w-full bg-emerald-500 active:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
                >
                  + Add Grocery Item
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Synced with your Airtable Base so you can check items off on your phone at Smith&apos;s!
              </p>
            </form>
          </div>
        )}
      </main>

      {/* --- BOTTOM NAVIGATION DOCK --- */}
      <footer className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-2xl px-4 py-2 mt-3 shrink-0">
        <div className="flex items-center space-x-2">
          {[
            { id: "tasks", label: "School & Chores", icon: CheckCircle2 },
            { id: "calendar", label: "Calendar", icon: CalendarIcon },
            { id: "rewards", label: "Rewards", icon: Trophy },
            { id: "meals", label: "Meals", icon: Utensils },
            { id: "shopping", label: "Groceries", icon: ShoppingCart },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-indigo-500 text-white shadow-lg"
                    : "text-slate-300 hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center space-x-1.5 bg-emerald-500 active:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Task / Chore</span>
        </button>
      </footer>

      {/* --- ADD TASK MODAL --- */}
      {showAddTask && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <form
            onSubmit={handleAddTask}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-96 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Schoolwork or Chore</h3>
              <button type="button" onClick={() => setShowAddTask(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <input
              type="text"
              required
              placeholder="Task title (e.g., Practice Saxophone)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {kids.map((k) => (
                  <option key={k.id} value={k.name}>
                    {k.name}
                  </option>
                ))}
              </select>

              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="school">Schoolwork</option>
                <option value="chore">Chore</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2">
              <span className="text-xs text-slate-300">Star Points:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                className="w-16 bg-transparent text-right font-bold text-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              Save Task
            </button>
          </form>
        </div>
      )}

      {/* --- PIN UNLOCK MODAL (Switches from Demo Mode to Live Family Data) --- */}
      {showPinModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Unlock Live Family Mode</h3>
              <button onClick={() => setShowPinModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <input
              type="password"
              placeholder="Enter FAMILY_PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-center text-lg tracking-widest text-white"
            />
            <button
              onClick={() => {
                localStorage.setItem("family_hub_pin", pinInput);
                setPin(pinInput);
                setShowPinModal(false);
                fetchAllData(pinInput);
              }}
              className="w-full bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
            >
              Connect Live Database
            </button>
          </div>
        </div>
      )}
    </div>
  );
}