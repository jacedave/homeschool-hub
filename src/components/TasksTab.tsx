"use client";

import React, { useRef, useState } from "react";
import { ArrowUpToLine, BookOpen, CheckCircle2, Circle, Pencil, Repeat, Sparkles, Star, X } from "lucide-react";
import Avatar from "./Avatar";
import { kidColor } from "@/lib/colors";
import { isVisibleToday, sortedKidTasks, type TaskPlacement } from "@/lib/rules";
import type { Kid, TaskItem } from "@/lib/types";

/** How long to press and hold a task before it can be moved. */
const HOLD_MS = 2000;

interface Props {
  kids: Kid[];
  tasks: TaskItem[];
  onToggle: (task: TaskItem) => void;
  onPlace: (task: TaskItem, toKid: string, where: TaskPlacement) => void;
  today: string;
  /** True while a parent has unlocked the app: shows the edit buttons. */
  parentMode: boolean;
  onEdit: (task: TaskItem) => void;
}

interface DragState {
  task: TaskItem;
  x: number;
  y: number;
  moved: boolean;
}

interface Hover {
  kid?: string;
  before?: string;
  top?: boolean;
}

/** The picture or emoji that shows the kid what the task is. */
function TaskPicture({ task, size = 96 }: { task: TaskItem; size?: number }) {
  if (task.imageUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={task.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className="shrink-0 rounded-2xl bg-white object-cover shadow-sm" />
    );
  if (task.icon)
    return (
      <span style={{ width: size, height: size, fontSize: size * 0.64 }} className="flex shrink-0 items-center justify-center rounded-2xl bg-white leading-none shadow-sm">
        {task.icon}
      </span>
    );
  return null;
}

export default function TasksTab({ kids, tasks, onToggle, onPlace, today, parentMode, onEdit }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<Hover>({});
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [menuTask, setMenuTask] = useState<TaskItem | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  const cols = Math.min(Math.max(kids.length, 1), 4);

  /** What is under the finger: the "move to top" zone, another task, or a kid's column. */
  const targetAt = (x: number, y: number, draggedId: string): Hover => {
    const el = document.elementFromPoint(x, y);
    if (el?.closest("[data-top-zone]")) return { top: true };
    const taskId = el?.closest("[data-task-id]")?.getAttribute("data-task-id");
    const kid = el?.closest("[data-kid-col]")?.getAttribute("data-kid-col") ?? undefined;
    return { kid, before: taskId && taskId !== draggedId ? taskId : undefined };
  };

  const onPointerDown = (e: React.PointerEvent, task: TaskItem) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    setHoldingId(task.id);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", blockScroll);
      setHoldingId(null);
    };
    const finish = (commit: boolean) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setHover({});
      // The browser sends a click after the finger lifts; ignore it so the task isn't toggled.
      window.setTimeout(() => (suppressClick.current = false), 400);
      if (!d || !commit) return;
      if (!d.moved) return setMenuTask(d.task); // held but not dragged: show the move menu
      const t = targetAt(d.x, d.y, d.task.id);
      if (t.top) onPlace(d.task, d.task.assignee, "top");
      else if (t.kid) onPlace(d.task, t.kid, t.before ? { before: t.before } : "end");
    };
    const timer = window.setTimeout(() => {
      suppressClick.current = true;
      dragRef.current = { task, x: startX, y: startY, moved: false };
      setDrag(dragRef.current);
      setHoldingId(null);
    }, HOLD_MS);

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (d) {
        const next = { ...d, x: ev.clientX, y: ev.clientY, moved: d.moved || Math.hypot(ev.clientX - startX, ev.clientY - startY) > 16 };
        dragRef.current = next;
        setDrag(next);
        setHover(targetAt(ev.clientX, ev.clientY, d.task.id));
      } else if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 12) {
        cleanup(); // the finger moved before the hold finished: it's a scroll, not a hold
      }
    };
    const up = () => {
      cleanup();
      finish(true);
    };
    const cancel = () => {
      cleanup();
      finish(false);
    };
    // Once picked up, stop the page from scrolling under the finger.
    const blockScroll = (ev: TouchEvent) => {
      if (dragRef.current) ev.preventDefault();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", blockScroll, { passive: false });
  };

  return (
    <>
      <div className="grid h-full gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {kids.map((kid) => {
          const style = kidColor(kid.color);
          const kidTasks = sortedKidTasks(tasks, kid.name).filter((t) => isVisibleToday(t, today));
          const open = kidTasks.filter((t) => !t.completed);
          const done = kidTasks.filter((t) => t.completed);
          const pct = kidTasks.length ? Math.round((done.length / kidTasks.length) * 100) : 0;
          const colHover = drag && hover.kid === kid.name;

          return (
            <section
              key={kid.id}
              data-kid-col={kid.name}
              className={`flex min-h-0 flex-col rounded-3xl border bg-white p-4 shadow-sm transition ${colHover ? "border-indigo-400 ring-4 ring-indigo-200" : style.border}`}
            >
              <header className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <Avatar kid={kid} size={44} />
                  <h2 className="text-xl font-bold text-slate-800">{kid.name}</h2>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="text-lg font-extrabold tabular-nums text-amber-700">{kid.stars}</span>
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
                {[...open, ...done].map((task) => {
                  const lifted = drag?.task.id === task.id;
                  const dropAbove = drag && hover.before === task.id && !lifted;
                  return (
                    <button
                      key={task.id}
                      data-task-id={task.id}
                      onPointerDown={(e) => onPointerDown(e, task)}
                      onClick={() => {
                        if (suppressClick.current) return;
                        onToggle(task);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`relative flex w-full flex-wrap items-center gap-x-3.5 gap-y-2.5 overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.97] ${
                        task.completed ? "border-transparent bg-sky-50 opacity-60" : `${style.bg} ${style.border}`
                      } ${lifted ? "opacity-30" : ""} ${dropAbove ? "border-t-4 border-t-indigo-500" : ""}`}
                    >
                      {task.completed ? <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" /> : <Circle className="h-8 w-8 shrink-0 text-slate-400" />}
                      <div className="min-w-[6.5rem] flex-1">
                        <p className={`text-lg font-semibold leading-snug ${task.completed ? "text-slate-500 line-through" : "text-slate-800"}`}>{task.title}</p>
                        <div className="mt-1.5 flex items-center gap-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            {task.category === "school" ? <BookOpen className="h-3 w-3 text-indigo-500" /> : <Sparkles className="h-3 w-3 text-amber-500" />}
                            {task.category === "school" ? "School" : "Chore"}
                          </span>
                          {task.repeat !== "none" && <Repeat className="h-3 w-3 text-sky-500" aria-label="Repeats" />}
                          <span className="font-bold text-amber-600">+{task.points}★</span>
                        </div>
                      </div>
                      {/* Sits beside the task, or wraps underneath when the column is too narrow. */}
                      <TaskPicture task={task} />
                      {parentMode && (
                        <span
                          role="button"
                          aria-label={`Edit ${task.title}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(task);
                          }}
                          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-indigo-600 shadow active:scale-90"
                        >
                          <Pencil className="h-4 w-4" />
                        </span>
                      )}
                      {holdingId === task.id && <span className="hold-bar absolute bottom-0 left-0 h-1.5 bg-indigo-500" style={{ animationDuration: `${HOLD_MS}ms` }} />}
                    </button>
                  );
                })}
                {kidTasks.length === 0 && <p className="pt-6 text-center text-sm text-slate-400">Nothing to do today 🎉</p>}
              </div>
            </section>
          );
        })}
      </div>

      {/* While dragging: the floating task and a drop zone for "move to top". */}
      {drag && (
        <>
          <div
            data-top-zone
            className={`fixed bottom-28 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold shadow-xl ${hover.top ? "bg-indigo-500 text-white" : "bg-white text-indigo-600"}`}
          >
            <ArrowUpToLine className="h-5 w-5" /> Drop here to move to the top
          </div>
          <div className="pointer-events-none fixed z-[56] w-64 -translate-x-1/2 -translate-y-1/2 scale-105 rounded-2xl border-2 border-indigo-400 bg-white px-4 py-3 shadow-2xl" style={{ left: drag.x, top: drag.y }}>
            <p className="text-base font-semibold text-slate-800">{drag.task.title}</p>
            <p className="text-xs text-slate-500">{drag.moved ? "Drop on a name to give it to them, or on a task to put it above" : "Drag it, or let go for options"}</p>
          </div>
        </>
      )}

      {/* Held without dragging: simple buttons instead. */}
      {menuTask && (
        <div className="fixed inset-0 z-[57] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setMenuTask(null)}>
          <div className="w-[26rem] max-w-full space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Move task</p>
                <h3 className="text-lg font-bold text-slate-800">{menuTask.title}</h3>
              </div>
              <button type="button" onClick={() => setMenuTask(null)} aria-label="Close" className="rounded-full p-1.5 active:bg-sky-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <button
              onClick={() => {
                onPlace(menuTask, menuTask.assignee, "top");
                setMenuTask(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-4 text-base font-bold text-white active:scale-95"
            >
              <ArrowUpToLine className="h-5 w-5" /> Move to top of the list
            </button>
            <button
              onClick={() => {
                onEdit(menuTask);
                setMenuTask(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 py-3.5 text-base font-bold text-indigo-600 active:scale-95"
            >
              <Pencil className="h-5 w-5" /> Edit task
            </button>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Give to someone else</p>
              <div className="grid grid-cols-2 gap-2.5">
                {kids
                  .filter((k) => k.name !== menuTask.assignee)
                  .map((k) => (
                    <button
                      key={k.id}
                      onClick={() => {
                        onPlace(menuTask, k.name, "end");
                        setMenuTask(null);
                      }}
                      className={`flex items-center gap-3 rounded-2xl border-2 ${kidColor(k.color).border} ${kidColor(k.color).bg} px-3 py-3 text-left active:scale-95`}
                    >
                      <Avatar kid={k} size={40} />
                      <span className="truncate text-base font-extrabold text-slate-800">{k.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
