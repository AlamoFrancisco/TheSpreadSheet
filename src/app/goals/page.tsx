'use client';

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";

interface Goal {
  id: number;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  type: "goal" | "debt";
  interestRate: number | null;
}

function monthsBetween(startDate: Date, endDate: string): number {
  const start = startDate;
  const end = new Date(endDate);
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1)
  );
}

export default function GoalsManager() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [type, setType] = useState<"goal" | "debt">("goal");
  const [interestRate, setInterestRate] = useState("");

  const addGoal = () => {
    const t = Number(target);
    const s = Number(saved);
    const r = Number(interestRate);

    if (!name.trim() || !Number.isFinite(t) || t <= 0 || !deadline) {
      alert("Please enter valid data including a future deadline");
      return;
    }

    if (type === "goal" && (s < 0 || s > t)) {
      alert("Saved amount must be between 0 and target");
      return;
    }

    if (type === "debt" && (!interestRate || r < 0)) {
      alert("Please provide a valid interest rate for debt");
      return;
    }

    setGoals((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: name.trim(),
        target: t,
        saved: type === "goal" ? s : 0,
        deadline,
        type,
        interestRate: type === "debt" ? r : null,
      },
    ]);

    // Reset form
    setName("");
    setTarget("");
    setSaved("");
    setDeadline("");
    setType("goal");
    setInterestRate("");
  };

  const updateSaved = (id: number, newSaved: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, saved: Math.min(g.target, Math.max(0, newSaved)) }
          : g
      )
    );
  };

  const removeGoal = (id: number) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <>
      <Navbar />

      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Savings & Debt Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full p-2 border rounded"
              value={type}
              onChange={(e) => setType(e.target.value as "goal" | "debt")}
            >
              <option value="goal">Savings Goal</option>
              <option value="debt">Debt Repayment</option>
            </select>

            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              type="number"
              placeholder={type === "goal" ? "Target amount" : "Debt balance"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            {type === "goal" && (
              <Input
                type="number"
                placeholder="Amount saved"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
              />
            )}
            {type === "debt" && (
              <Input
                type="number"
                placeholder="Interest rate (APR %)"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            )}
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <Button onClick={addGoal} className="w-full">
              Add {type === "goal" ? "Goal" : "Debt"}
            </Button>
          </CardContent>
        </Card>

        {goals.map((goal) => {
          const pct = (goal.saved / goal.target) * 100;
          const monthsLeft = monthsBetween(new Date(), goal.deadline);
          const remaining = goal.target - goal.saved;
          const monthlyNeed = monthsLeft > 0 ? remaining / monthsLeft : 0;

          const totalWithInterest =
            goal.type === "debt" && goal.interestRate !== null
              ? goal.target * Math.pow(1 + goal.interestRate / 100 / 12, monthsLeft)
              : null;

          const monthlyPayment =
            totalWithInterest && monthsLeft > 0
              ? totalWithInterest / monthsLeft
              : null;

          return (
            <Card key={goal.id} className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {goal.name} {goal.type === "debt" ? "(Debt)" : "(Goal)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>Target: £{goal.target.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>

                {goal.type === "goal" && (
                  <>
                    <div>
                      Saved: £{goal.saved.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct.toFixed(0)}%)
                    </div>
                    <Progress value={pct} />
                  </>
                )}

                <div>Deadline: {new Date(goal.deadline).toLocaleDateString()}</div>
                <div>Months Left: {monthsLeft}</div>

                {goal.type === "debt" ? (
                  <>
                    <div>Interest Rate: {goal.interestRate}%</div>
                    <div>
                      Total with Interest: £
                      {totalWithInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                    </div>
                    <div className="font-semibold text-red-600">
                      Monthly Repayment Needed: £
                      {monthlyPayment?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                    </div>
                  </>
                ) : (
                  <div className="font-semibold text-blue-700">
                    Monthly Needed: £{monthlyNeed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                )}

                {goal.type === "goal" && (
                  <Input
                    type="number"
                    value={goal.saved}
                    onChange={(e) => updateSaved(goal.id, Number(e.target.value))}
                  />
                )}
                <Button variant="destructive" onClick={() => removeGoal(goal.id)}>
                  Remove
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
