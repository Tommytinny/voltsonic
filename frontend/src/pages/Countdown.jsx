import { useEffect, useMemo, useState } from "react";
import { Rocket, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const LAUNCH_TARGET = String(import.meta.env.VITE_LAUNCH_HOUR || "15").trim();

function pad(value) {
  return String(value).padStart(2, "0");
}

function getNigeriaLaunchDate(now) {
  const target = new Date(now.getTime());
  target.setUTCHours(LAUNCH_TARGET, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

function getLaunchDate(now) {
  /*const raw = LAUNCH_TARGET;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }*/
  return getNigeriaLaunchDate(now);
}

export default function Countdown() {
  const [now, setNow] = useState(new Date());
  const [launchDate] = useState(() => getLaunchDate(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const remaining = useMemo(() => {
    const diff = Math.max(launchDate.getTime() - now.getTime(), 0);
    const seconds = Math.floor(diff / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return {
      hours,
      minutes,
      seconds: secs,
      completed: diff === 0,
    };
  }, [now, launchDate]);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <main className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-10 shadow-[0_0_60px_rgba(8,145,178,0.12)]">
        <div className="flex items-center gap-3 text-[hsl(185_100%_50%)]">
          <Rocket className="h-8 w-8" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground">Launching soon</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">VoltSonic is going live</h1>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground">
          This page counts down to the next launch moment. Come back when the timer reaches zero or follow the progress to know when the game is ready.
        </p>

        <div className="mt-10 grid gap-3 grid-cols-3 sm:grid-cols-3 justify-items-center">
          
          <div className="rounded-3xl border border-border bg-[hsl(230_20%_16%)] p-5 text-center">
            <div className="text-5xl font-black tabular-nums">{pad(remaining.hours)}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Hours</div>
          </div>
          <div className="rounded-3xl border border-border bg-[hsl(230_20%_16%)] p-5 text-center">
            <div className="text-5xl font-black tabular-nums">{pad(remaining.minutes)}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Minutes</div>
          </div>
          <div className="rounded-3xl border border-border bg-[hsl(230_20%_16%)] p-5 text-center">
            <div className="text-5xl font-black tabular-nums">{pad(remaining.seconds)}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Seconds</div>
          </div>
        </div>

        

        {remaining.completed && (
          <div className="mt-10 rounded-3xl border border-[hsl(185_100%_50%)] bg-[hsl(185_100%_50%)/10] p-6 text-center text-sm font-semibold text-[hsl(185_100%_50%)]">
            Launch time has arrived! Refresh the app or head to the game page now.
          </div>
        )}
      </main>
    </div>
  );
}
