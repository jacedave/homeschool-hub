"use client";

import React from "react";
import { BookOpen, CheckCircle2, Circle, Repeat, Sparkles, Star } from "lucide-react";
import { kidColor } from "@/lib/colors";
import type { Kid, TaskItem } from "@/lib/types";

interface Props {
  kids: Kid[];
  tasks: TaskItem[];
  onToggle: (task: TaskItem) => void;
}

export default function TasksTab({ kids, tasks, onToggle }: Props) {
  const cols = Math.min(Math.max(kids.length, 1), 4);
  return (
    <div className="grid h-full gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {kids.map((kid) => {
        const style = kidColor(kid.color);
        const kidTasks = tasks.filter((t) => t.assignee === kid.name && t.dueToday);
        const open = kidTasks.filter((t) => !t.completed);
        const done = kidTasks.filter((t) => t.completed);
        const pct = kidTasks.length ? Math.round((done.length / kidTasks.length) * 100) : 0;

        return (
          <section
            key={kid.id}
            className={`flex min-h-0 flex-col rounded-3xl border ${style.border} bg-white shadow-sm p-4`}
          >
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${style.solid} text-lg font-extrabold text-white`}>
                  {kid.name.charAt(0)}
                </span>
                <h2 className="text-xl font-bold text-slate-800">{kid.name}</h2>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <span className="text-lg font-extrabold tabular-nums text-amber-600">{kid.stars}</span>
              </div>
            </header>

            <div className="mb-3 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sky-100">
                <div className={`${style.solid} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right text-xs font-semibold text-slate-500">
                {done.length}/{kidTasks.length}
              </span>
            </div>

            <div className="scroll-y min-h-0 flex-1 space-y-2 pr-0.5">
              {[...open, ...done].map((task) => (
                <button
                  key={task.id}
                  onClick={() => onToggle(task)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.97] ${
                    task.completed
                      ? "border-transparent bg-sky-50 opacity-55"
                      : `${style.bg} ${style.border}`
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-7 w-7 shrink-0 text-slate-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-semibold leading-snug ${task.completed ? "text-slate-500 line-through" : "text-slate-800"}`}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        {task.category === "school" ? (
                          <BookOpen className="h-3 w-3 text-indigo-600" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-amber-600" />
                        )}
                        {task.category === "school" ? "School" : "Chore"}
                      </span>
                      {task.repeat !== "none" && <Repeat className="h-3 w-3 text-sky-600" aria-label="Repeats" />}
                      <span className="font-bold text-amber-600">+{task.points}★</span>
                    </div>
                  </div>
                </button>
              ))}
              {kidTasks.length === 0 && <p className="pt-6 text-center text-sm text-slate-500">Nothing to do today 🎉</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
