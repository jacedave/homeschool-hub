"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, Star, Utensils, Calendar, RotateCcw, BookOpen, Sparkles } from "lucide-react";

interface Task {
  id: string;
  title: string;
  category: "school" | "chore";
  completed: boolean;
}

interface KidColumn {
  id: string;
  name: string;
  color: string;
  bgAccent: string;
  borderAccent: string;
  stars: number;
  tasks: Task[];
}

const INITIAL_DATA: KidColumn[] = [
  {
    id: "kid-1",
    name: "Charles",
    color: "text-blue-400",
    bgAccent: "bg-blue-500/10",
    borderAccent: "border-blue-500/30",
    stars: 12,
    tasks: [
      { id: "c1", title: "Math Lesson", category: "school", completed: false },
      { id: "c2", title: "Reading (20 mins)", category: "school", completed: false },
      { id: "c3", title: "Handwriting Practice", category: "school", completed: false },
      { id: "c4", title: "Make Bed & Tidy Room", category: "chore", completed: false },
      { id: "c5", title: "Clear Breakfast Dishes", category: "chore", completed: false },
    ],
  },
  {
    id: "kid-2",
    name: "Wesley",
    color: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    borderAccent: "border-emerald-500/30",
    stars: 10,
    tasks: [
      { id: "w1", title: "Math Practice", category: "school", completed: false },
      { id: "w2", title: "Phonics / Reading", category: "school", completed: false },
      { id: "w3", title: "Science Activity", category: "school", completed: false },
      { id: "w4", title: "Make Bed", category: "chore", completed: false },
      { id: "w5", title: "Put Away Shoes & Toys", category: "chore", completed: false },
    ],
  },
  {
    id: "kid-3",
    name: "Son 3",
    color: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    borderAccent: "border-amber-500/30",
    stars: 8,
    tasks: [
      { id: "s1", title: "Letters & Numbers", category: "school", completed: false },
      { id: "s2", title: "Story Time", category: "school", completed: false },
      { id: "s3", title: "Pick Up Blocks", category: "chore", completed: false },
      { id: "s4", title: "Get Dressed", category: "chore", completed: false },
    ],
  },
  {
    id: "kid-4",
    name: "Son 4",
    color: "text-purple-400",
    bgAccent: "bg-purple-500/10",
    borderAccent: "border-purple-500/30",
    stars: 6,
    tasks: [
      { id: "b1", title: "Colors & Shapes", category: "school", completed: false },
      { id: "b2", title: "Read Picture Book", category: "school", completed: false },
      { id: "b3", title: "Put Toys in Bin", category: "chore", completed: false },
    ],
  },
];

export default function HomeschoolDashboard() {
  const [kids, setKids] = useState<KidColumn[]>(INITIAL_DATA);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("homeschool_hub_v1");
    if (saved) {
      try {
        setKids(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("homeschool_hub_v1", JSON.stringify(kids));
  }, [kids]);

  // Live clock compatible with iOS 15
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  const toggleTask = (kidId: string, taskId: string) => {
    setKids((prev) =>
      prev.map((kid) => {
        if (kid.id !== kidId) return kid;
        let starDelta = 0;
        const updatedTasks = kid.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextState = !t.completed;
          starDelta = nextState ? 1 : -1;
          return { ...t, completed: nextState };
        });
        return {
          ...kid,
          stars: Math.max(0, kid.stars + starDelta),
          tasks: updatedTasks,
        };
      })
    );
  };

  const resetDay = () => {
    setKids((prev) =>
      prev.map((kid) => ({
        ...kid,
        tasks: kid.tasks.map((t) => ({ ...t, completed: false })),
      }))
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 p-4 select-none overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded-2xl px-5 py-3 mb-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Loosle Family Hub</h1>
            <p className="text-xs text-slate-400">{currentDate || "Loading date..."}</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 bg-slate-900/70 px-4 py-2 rounded-xl border border-slate-700">
            <Utensils className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Dinner:</span>
            <span className="text-sm font-semibold text-slate-200">Homemade Pizza Night</span>
          </div>

          <button
            onClick={resetDay}
            className="flex items-center space-x-1.5 bg-slate-700/60 active:bg-slate-600 px-3 py-2 rounded-xl text-xs font-medium text-slate-300"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Day</span>
          </button>

          <div className="text-2xl font-bold text-white tabular-nums">
            {currentTime}
          </div>
        </div>
      </header>

      {/* 4-Column Student Grid */}
      <main className="grid grid-cols-4 gap-3 flex-1 min-h-0">
        {kids.map((kid) => {
          const completedCount = kid.tasks.filter((t) => t.completed).length;
          const progressPct = Math.round((completedCount / kid.tasks.length) * 100);

          return (
            <div
              key={kid.id}
              className={`flex flex-col rounded-2xl border ${kid.borderAccent} bg-slate-800/50 p-3 overflow-hidden`}
            >
              {/* Kid Header & Stars */}
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-lg font-bold ${kid.color}`}>{kid.name}</h2>
                <div className="flex items-center space-x-1 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-amber-300">{kid.stars}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Scrollable Task List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {kid.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(kid.id, task.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      task.completed
                        ? "bg-slate-800/40 border-slate-700/50 opacity-50"
                        : `${kid.bgAccent} ${kid.borderAccent} active:scale-95`
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 pr-2">
                      {task.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium leading-snug ${
                            task.completed ? "line-through text-slate-400" : "text-slate-100"
                          }`}
                        >
                          {task.title}
                        </p>
                        <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
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
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
