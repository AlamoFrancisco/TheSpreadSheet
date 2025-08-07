'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type GoalType = 'goal' | 'debt';

type Goal = {
  id: string;
  user_id: string;
  name: string;
  type: GoalType;
  target: number;          // for savings: target; for debt: current balance
  saved: number;           // used only for savings goals (ignored for debt)
  deadline: string;        // yyyy-mm-dd
  interest_rate: number | null; // APR% for debt
  created_at: string;
  updated_at: string | null;
};

type GoalEventKind = 'contribution' | 'withdrawal' | 'debt_payment' | 'interest_charge';

type GoalEvent = {
  id: string;
  goal_id: string;
  user_id: string;
  kind: GoalEventKind;
  amount: number;
  occurred_at: string;
  note: string | null;
  created_at: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function monthsBetween(startDate: Date, endDate: string): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function debtMonthlyPayment(balance: number, aprPct: number, months: number): number {
  if (months <= 0) return 0;
  const r = (aprPct || 0) / 100 / 12;
  if (r <= 0) return balance / months;
  const f = Math.pow(1 + r, months);
  return (balance * r * f) / (f - 1);
}

export default function GoalsManager() {
  const router = useRouter();

  // session
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [eventsByGoal, setEventsByGoal] = useState<Record<string, GoalEvent[]>>({});

  // create form
  const [type, setType] = useState<GoalType>('goal');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');
  const [interestRate, setInterestRate] = useState('');

  // per-goal quick event form state
  const [eventKind, setEventKind] = useState<Record<string, GoalEventKind>>({});
  const [eventAmount, setEventAmount] = useState<Record<string, string>>({});
  const [eventNote, setEventNote] = useState<Record<string, string>>({});

  // debouncers for inline saved updates
  const debouncers = useRef<Record<string, any>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        router.replace('/login');
        return;
      }
      const uid = session.user.id;
      if (!active) return;
      setUserId(uid);

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      if (error) console.error('Fetch goals error:', error);
      if (data) setGoals(data as Goal[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  // fetch events after goals load
  useEffect(() => {
    (async () => {
      if (!userId || goals.length === 0) return;
      const goalIds = goals.map(g => g.id);
      const { data, error } = await supabase
        .from('goal_events')
        .select('*')
        .in('goal_id', goalIds)
        .order('occurred_at', { ascending: false });

      if (error) {
        console.error('Fetch events error:', error);
        return;
      }
      const grouped: Record<string, GoalEvent[]> = {};
      (data as GoalEvent[]).forEach(ev => {
        (grouped[ev.goal_id] ||= []).push(ev);
      });
      setEventsByGoal(grouped);
    })();
  }, [userId, goals]);

  const resetForm = () => {
    setName('');
    setTarget('');
    setSaved('');
    setDeadline('');
    setType('goal');
    setInterestRate('');
  };

  const addGoal = async () => {
    if (!userId) return;
    const t = Number(target);
    const s = Number(saved);
    const r = interestRate === '' ? null : Number(interestRate);

    if (!name.trim() || !Number.isFinite(t) || t <= 0 || !deadline) {
      alert('Please enter a valid name, positive target/balance, and a deadline.');
      return;
    }
    if (type === 'goal' && (!Number.isFinite(s) || s < 0 || s > t)) {
      alert('Saved must be between 0 and target.');
      return;
    }
    if (type === 'debt' && (r === null || !Number.isFinite(r) || r < 0)) {
      alert('Please provide a valid interest rate for debt.');
      return;
    }

    const payload = {
      user_id: userId,
      name: name.trim(),
      type,
      target: t,
      saved: type === 'goal' ? s : 0,
      deadline,
      interest_rate: type === 'debt' ? r : null,
    };

    // optimistic insert
    const temp: Goal = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: payload.name,
      type: payload.type,
      target: payload.target,
      saved: payload.saved,
      deadline: payload.deadline,
      interest_rate: payload.interest_rate,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    setGoals(prev => [...prev, temp]);

    const { data, error } = await supabase.from('goals').insert(payload).select('*').single();
    if (error || !data) {
      console.error('Insert goal error:', error);
      setGoals(prev => prev.filter(g => g.id !== temp.id));
      alert('Failed to add goal.');
      return;
    }
    setGoals(prev => prev.map(g => (g.id === temp.id ? (data as Goal) : g)));
    resetForm();
  };

  const updateSavedInline = (id: string, value: number) => {
    setGoals(prev =>
      prev.map(g => (g.id === id ? { ...g, saved: clamp(value, 0, g.target) } : g))
    );
    if (debouncers.current[id]) clearTimeout(debouncers.current[id]);
    debouncers.current[id] = setTimeout(async () => {
      const goal = goals.find(g => g.id === id);
      if (!goal) return;
      const val = clamp(value, 0, goal.target);
      const { error } = await supabase.from('goals').update({ saved: val }).eq('id', id).eq('user_id', userId!);
      if (error) {
        console.error('Update saved error:', error);
        alert('Failed to update saved amount.');
      }
    }, 350);
  };

  const removeGoal = async (id: string) => {
    const prev = goals;
    setGoals(g => g.filter(x => x.id !== id));
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId!);
    if (error) {
      console.error('Delete goal error:', error);
      alert('Failed to remove goal.');
      setGoals(prev); // rollback
    } else {
      setEventsByGoal(prevEvents => {
        const copy = { ...prevEvents };
        delete copy[id];
        return copy;
      });
    }
  };

  async function addEvent(goal: Goal) {
    if (!userId) return;
    const kind = (eventKind[goal.id] ||
      (goal.type === 'goal' ? 'contribution' : 'debt_payment')) as GoalEventKind;

    const amtRaw = eventAmount[goal.id];
    const amt = Number(amtRaw);
    const note = (eventNote[goal.id] ?? '').trim() || null;

    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Enter a valid amount.');
      return;
    }

    const temp: GoalEvent = {
      id: crypto.randomUUID(),
      goal_id: goal.id,
      user_id: userId,
      kind,
      amount: amt,
      occurred_at: new Date().toISOString(),
      note,
      created_at: new Date().toISOString(),
    };

    // optimistic add to list
    setEventsByGoal(prev => ({ ...prev, [goal.id]: [temp, ...(prev[goal.id] || [])] }));

    const { data, error } = await supabase
      .from('goal_events')
      .insert({
        goal_id: goal.id,
        kind,
        amount: amt,
        note,
        occurred_at: temp.occurred_at,
        user_id: userId, // filled by trigger, kept for TS
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('Insert event error:', error);
      // rollback
      setEventsByGoal(prev => ({
        ...prev,
        [goal.id]: (prev[goal.id] || []).filter(e => e.id !== temp.id),
      }));
      alert('Failed to add event.');
      return;
    }

    // swap temp for server row
    setEventsByGoal(prev => ({
      ...prev,
      [goal.id]: [data as GoalEvent, ...(prev[goal.id] || []).filter(e => e.id !== temp.id)],
    }));

    // refetch goal (server recompute updated totals)
    const { data: refreshed } = await supabase.from('goals').select('*').eq('id', goal.id).single();
    if (refreshed) {
      setGoals(prev => prev.map(g => (g.id === goal.id ? (refreshed as Goal) : g)));
    }

    // clear quick form fields
    setEventAmount(prev => ({ ...prev, [goal.id]: '' }));
    setEventNote(prev => ({ ...prev, [goal.id]: '' }));
  }

  const totals = useMemo(() => {
    const goalItems = goals.filter(g => g.type === 'goal');
    const debtItems = goals.filter(g => g.type === 'debt');

    const goalTarget = goalItems.reduce((s, g) => s + g.target, 0);
    const goalSaved = goalItems.reduce((s, g) => s + g.saved, 0);
    const debtBalance = debtItems.reduce((s, g) => s + g.target, 0);

    const goalPct = goalTarget > 0 ? Math.min(100, (goalSaved / goalTarget) * 100) : 0;

    return { goalTarget, goalSaved, debtBalance, goalPct };
  }, [goals]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center p-6">Loading…</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        {/* Overview */}
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-xl">Your Goals Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 p-4 rounded-xl shadow">
              <div className="font-semibold">Total Savings Target</div>
              <div>£{totals.goalTarget.toLocaleString()}</div>
              <div className="mt-2">Saved: £{totals.goalSaved.toLocaleString()}</div>
              <Progress value={totals.goalPct} />
            </div>
            <div className="bg-gray-50 p-4 rounded-xl shadow">
              <div className="font-semibold">Savings Progress</div>
              <div>{totals.goalPct.toFixed(0)}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl shadow">
              <div className="font-semibold">Total Debt Balance</div>
              <div>£{totals.debtBalance.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>

        {/* Create */}
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Add Savings or Debt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full p-2 border rounded"
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
            >
              <option value="goal">Savings Goal</option>
              <option value="debt">Debt Repayment</option>
            </select>

            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              type="number"
              placeholder={type === 'goal' ? 'Target amount' : 'Debt balance'}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            {type === 'goal' && (
              <Input
                type="number"
                placeholder="Amount saved"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
              />
            )}
            {type === 'debt' && (
              <Input
                type="number"
                placeholder="Interest rate (APR %)"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            )}
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <Button onClick={addGoal} className="w-full">
              Add {type === 'goal' ? 'Goal' : 'Debt'}
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        {goals.map((goal) => {
          const monthsLeft = monthsBetween(new Date(), goal.deadline);
          const remaining = Math.max(0, goal.type === 'goal' ? goal.target - goal.saved : goal.target);

          // Savings projection
          const monthlyNeedSavings =
            goal.type === 'goal' && monthsLeft > 0 ? remaining / monthsLeft : 0;
          const pct = goal.type === 'goal'
            ? goal.target > 0
              ? (goal.saved / goal.target) * 100
              : 0
            : 0;

          // Debt projection
          const monthlyPaymentDebt =
            goal.type === 'debt' && monthsLeft > 0
              ? debtMonthlyPayment(goal.target, goal.interest_rate ?? 0, monthsLeft)
              : 0;
          const totalCostDebt =
            goal.type === 'debt' && monthsLeft > 0 ? monthlyPaymentDebt * monthsLeft : goal.target;
          const totalInterestDebt =
            goal.type === 'debt' && monthsLeft > 0 ? totalCostDebt - goal.target : 0;

          const evs = eventsByGoal[goal.id] || [];

          return (
            <Card key={goal.id} className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {goal.name} {goal.type === 'debt' ? '(Debt)' : '(Goal)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>Deadline: {new Date(goal.deadline).toLocaleDateString()}</div>
                <div>Months Left: {monthsLeft}</div>

                {goal.type === 'goal' ? (
                  <>
                    <div>Target: £{goal.target.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div>
                      Saved: £{goal.saved.toLocaleString(undefined, { minimumFractionDigits: 2 })} (
                      {Math.min(100, Math.max(0, pct)).toFixed(0)}%)
                    </div>
                    <Progress value={Math.min(100, Math.max(0, pct))} />
                    <div className="font-semibold text-blue-700">
                      Monthly Needed: £{monthlyNeedSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Adjust saved:</span>
                      <Input
                        type="number"
                        value={goal.saved}
                        onChange={(e) => updateSavedInline(goal.id, Number(e.target.value))}
                        className="w-40"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>Balance: £{goal.target.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div>APR: {goal.interest_rate ?? 0}%</div>
                    <div className="font-semibold text-red-600">
                      Monthly Repayment Needed: £
                      {monthlyPaymentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div>Total Interest (over remaining term): £{totalInterestDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div>Total Cost (payments): £{totalCostDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </>
                )}

                {/* Quick Event Form */}
                <div className="mt-2 p-3 border rounded-md">
                  <div className="text-sm font-semibold mb-2">
                    Add {goal.type === 'goal' ? 'Contribution / Withdrawal' : 'Debt Payment / Interest'}
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <select
                      className="border rounded p-2"
                      value={eventKind[goal.id] || (goal.type === 'goal' ? 'contribution' : 'debt_payment')}
                      onChange={(e) =>
                        setEventKind(prev => ({ ...prev, [goal.id]: e.target.value as GoalEventKind }))
                      }
                    >
                      {goal.type === 'goal' ? (
                        <>
                          <option value="contribution">Contribution</option>
                          <option value="withdrawal">Withdrawal</option>
                        </>
                      ) : (
                        <>
                          <option value="debt_payment">Debt Payment</option>
                          <option value="interest_charge">Interest Charge</option>
                        </>
                      )}
                    </select>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={eventAmount[goal.id] || ''}
                      onChange={(e) =>
                        setEventAmount(prev => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      className="md:w-40"
                    />
                    <Input
                      type="text"
                      placeholder="Note (optional)"
                      value={eventNote[goal.id] || ''}
                      onChange={(e) =>
                        setEventNote(prev => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      className="flex-1"
                    />
                    <Button onClick={() => addEvent(goal)}>Add</Button>
                  </div>
                </div>

                {/* Recent Activity */}
                {evs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Recent Activity</div>
                    <ul className="text-xs space-y-1">
                      {evs.slice(0, 6).map((ev) => (
                        <li key={ev.id} className="flex justify-between">
                          <span>
                            {new Date(ev.occurred_at).toLocaleDateString()} · {ev.kind.replace('_', ' ')}
                            {ev.note ? ` — ${ev.note}` : ''}
                          </span>
                          <span>
                            £{Number(ev.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
