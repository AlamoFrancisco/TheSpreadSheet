'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  FaPiggyBank,
  FaMoneyCheckAlt,
  FaUserClock,
  FaReceipt,
  FaHome as FaHouse,
} from 'react-icons/fa';

type Metrics = {
  savings?: number | null;
  debt_repayment?: number | null;
  retirement_pot?: number | null;
  monthly_expenses?: number | null;
  monthly_mortgage?: number | null;
  net_monthly?: number | null; // may or may not exist in your table, we’ll fallback if missing
  updated_at?: string | null;
};

type Category = {
  id: string;
  user_id: string;
  name: string;
  type: 'essentials' | 'priorities' | 'lifestyle';
  monthly_budget: number;
};

type Tx = {
  id: string;
  category_id: string;
  amount: number;
  occurred_on: string; // yyyy-mm-dd
};

type Goal = {
  id: string;
  type: 'goal' | 'debt';
  target: number; // for debt: current balance
  saved: number;  // for savings
};

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [netMonthlyIncome, setNetMonthlyIncome] = useState<number>(0);

  // Budget data (this month)
  const [categories, setCategories] = useState<Category[]>([]);
  const [txByCat, setTxByCat] = useState<Record<string, Tx[]>>({});

  // Goals snapshot
  const [savingsGoals, setSavingsGoals] = useState<Goal[]>([]);
  const [debts, setDebts] = useState<Goal[]>([]);

  // Month window
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/login');
        return;
      }
      const uid = session.user.id;

      // Profile, metrics, budget categories, month transactions, goals
      const [
        { data: profile, error: profileError },
        { data: metricsRow, error: metricsError },
        { data: cats, error: catErr },
        { data: txs, error: txErr },
        { data: goals, error: goalsErr },
        { data: profSalaryRow }, // fallback for income if needed
      ] = await Promise.all([
        supabase.from('profiles').select('first_name').eq('id', uid).single(),
        supabase
          .from('metrics')
          .select('savings, debt_repayment, retirement_pot, monthly_expenses, monthly_mortgage, net_monthly, updated_at')
          .eq('id', uid)
          .maybeSingle(),
        supabase.from('budget_categories').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabase
          .from('budget_transactions')
          .select('id, category_id, amount, occurred_on')
          .eq('user_id', uid)
          .gte('occurred_on', monthStart)
          .lte('occurred_on', monthEnd)
          .order('occurred_on', { ascending: false }),
        supabase.from('goals').select('id, type, target, saved').eq('user_id', uid),
        supabase.from('profiles').select('salary').eq('id', uid).single(),
      ]);

      if (!active) return;

      if (profile?.first_name) setFirstName(profile.first_name);
      if (metricsRow) setMetrics(metricsRow as Metrics);

      // Income: prefer metrics.net_monthly, fallback to salary/12
      const netMonthly = Number((metricsRow as any)?.net_monthly ?? 0);
      if (Number.isFinite(netMonthly) && netMonthly > 0) {
        setNetMonthlyIncome(netMonthly);
      } else {
        const annual = Number((profSalaryRow as any)?.salary ?? 0);
        setNetMonthlyIncome(Number.isFinite(annual) && annual > 0 ? annual / 12 : 0);
      }

      if (catErr) console.error('Categories error:', catErr);
      if (cats) setCategories(cats as Category[]);

      if (txErr) console.error('Transactions error:', txErr);
      if (txs) {
        const grouped: Record<string, Tx[]> = {};
        (txs as Tx[]).forEach((t) => {
          (grouped[t.category_id] ||= []).push(t);
        });
        setTxByCat(grouped);
      }

      if (goalsErr) console.error('Goals error:', goalsErr);
      if (goals) {
        const all = goals as Goal[];
        setSavingsGoals(all.filter((g) => g.type === 'goal'));
        setDebts(all.filter((g) => g.type === 'debt'));
      }

      if (profileError) console.error('Profile error:', profileError);
      if (metricsError && (metricsError as any).code !== 'PGRST116') {
        console.error('Metrics error:', metricsError);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router, monthStart, monthEnd]);

  // Budget aggregates
  const totalPlannedBudget = useMemo(
    () => categories.reduce((s, c) => s + Number(c.monthly_budget || 0), 0),
    [categories]
  );

  const totalMonthSpend = useMemo(
    () => Object.values(txByCat).flat().reduce((s, tx) => s + Number(tx.amount || 0), 0),
    [txByCat]
  );

  const spendByType = useMemo(() => {
    const acc: Record<'essentials' | 'priorities' | 'lifestyle', number> = {
      essentials: 0,
      priorities: 0,
      lifestyle: 0,
    };
    for (const c of categories) {
      const spent = (txByCat[c.id] || []).reduce((s, t) => s + Number(t.amount || 0), 0);
      acc[c.type] += spent;
    }
    return acc;
  }, [categories, txByCat]);

  const plannedByType = useMemo(() => {
    const acc: Record<'essentials' | 'priorities' | 'lifestyle', number> = {
      essentials: 0,
      priorities: 0,
      lifestyle: 0,
    };
    for (const c of categories) {
      acc[c.type] += Number(c.monthly_budget || 0);
    }
    return acc;
  }, [categories]);

  // Goals aggregates
  const savingsTarget = savingsGoals.reduce((s, g) => s + Number(g.target || 0), 0);
  const savingsSaved = savingsGoals.reduce((s, g) => s + Number(g.saved || 0), 0);
  const debtsBalance = debts.reduce((s, g) => s + Number(g.target || 0), 0);

  const safePct = (current: number, target: number) => {
    if (!target || target <= 0) return 0;
    return Math.max(0, Math.min((current / target) * 100, 100));
  };

  const getStatus = (pct: number) => {
    if (pct >= 100) return { label: '✅ On Track', color: 'text-green-600' };
    if (pct >= 80) return { label: '⚠️ Getting There', color: 'text-yellow-600' };
    return { label: '❌ Needs Work', color: 'text-red-600' };
  };

  // Dashboard “summary cards”
  const summaryCards = useMemo(
    () => [
      {
        key: 'income',
        title: 'Net Monthly Income',
        current: netMonthlyIncome,
        target: netMonthlyIncome, // full bar
        icon: <FaMoneyCheckAlt className="text-green-600 text-xl" />,
        footer: `Planned budget: £${totalPlannedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      },
      {
        key: 'budget',
        title: 'This Month Spend',
        current: totalMonthSpend,
        target: Math.max(netMonthlyIncome, totalPlannedBudget) || 1,
        icon: <FaReceipt className="text-yellow-600 text-xl" />,
        footer: `Remaining vs income: £${(netMonthlyIncome - totalMonthSpend).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      },
      {
        key: 'savings',
        title: 'Savings Progress',
        current: savingsSaved,
        target: Math.max(1, savingsTarget), // avoid /0
        icon: <FaPiggyBank className="text-pink-500 text-xl" />,
        footer: `Saved £${savingsSaved.toLocaleString()} of £${savingsTarget.toLocaleString()}`,
      },
      {
        key: 'debts',
        title: 'Debt Balance',
        current: debtsBalance,
        target: Math.max(1, debtsBalance), // full bar (we want to pay it down)
        icon: <FaHouse className="text-indigo-500 text-xl" />,
        footer: debtsBalance > 0 ? 'Keep chipping away 🔧' : 'No debt—nice!',
      },
      {
        key: 'retirement',
        title: 'Retirement Pot',
        current: Number(metrics.retirement_pot ?? 0),
        target: 500_000, // arbitrary goal; move to DB if you like
        icon: <FaUserClock className="text-blue-500 text-xl" />,
        footer: `Target £${(500_000).toLocaleString()}`,
      },
      {
        key: 'expenses',
        title: 'Monthly Expenses',
        current: Number(metrics.monthly_expenses ?? spendByType.essentials + spendByType.priorities + spendByType.lifestyle),
        target: netMonthlyIncome || 1,
        icon: <FaReceipt className="text-amber-600 text-xl" />,
        footer: `Planned £${totalPlannedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      },
    ],
    [
      netMonthlyIncome,
      totalPlannedBudget,
      totalMonthSpend,
      savingsSaved,
      savingsTarget,
      debtsBalance,
      metrics.retirement_pot,
      metrics.monthly_expenses,
      spendByType.essentials,
      spendByType.priorities,
      spendByType.lifestyle,
    ]
  );

  return (
    <>
      <Navbar />
      <main className="p-10 space-y-10 max-w-6xl mx-auto">
        <section>
          <h1 className="text-3xl font-bold mb-1">Welcome to The Spreadsheet</h1>
          {firstName ? (
            <p className="text-xl mb-2">Hi, {firstName}!</p>
          ) : (
            !loading && <p className="text-xl mb-2">Hi there!</p>
          )}
          {!loading && metrics?.updated_at && (
            <p className="text-xs text-gray-500">
              Last updated: {new Date(metrics.updated_at).toLocaleString()}
            </p>
          )}
        </section>

        <section>
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold mb-6 flex items-center gap-2"
          >
            <span role="img" aria-label="chart">📊</span> Your Finance Snapshot
          </motion.h2>

          {loading ? (
            <p>Loading your data...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {summaryCards.map((card, idx) => {
                const pct = safePct(card.current, card.target);
                const status = getStatus(pct);
                return (
                  <motion.div
                    key={card.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <Card className="shadow-xl rounded-2xl">
                      <CardHeader className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {card.icon} {card.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Current</span>
                          <span>£{Number(card.current || 0).toLocaleString()}</span>
                        </div>
                        <div className={`font-medium ${status.color}`}>Status: {status.label}</div>
                        <Progress value={pct} />
                        <div className="text-xs text-gray-500">{card.footer}</div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Budget by bucket (this month) */}
        {!loading && (
          <section className="space-y-4">
            <h3 className="text-2xl font-semibold">This Month by Bucket</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {(['essentials', 'priorities', 'lifestyle'] as const).map((type) => {
                const spent = spendByType[type];
                const planned = plannedByType[type];
                return (
                  <Card key={type} className="shadow-lg rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-lg">{type[0].toUpperCase() + type.slice(1)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Planned</span>
                        <span>£{planned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Spent</span>
                        <span>£{spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Left</span>
                        <span>£{Math.max(0, planned - spent).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <Progress value={planned ? Math.min(100, (spent / planned) * 100) : 0} />
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push('/budget')}
                        >
                          Manage {type}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick actions */}
        {!loading && (
          <section className="space-y-3">
            <h3 className="text-2xl font-semibold">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => router.push('/salary')}>Update Salary</Button>
              <Button onClick={() => router.push('/goals')}>Add Goal / Debt</Button>
              <Button onClick={() => router.push('/retirement')}>Tune Retirement Plan</Button>
              <Button onClick={() => router.push('/budget')}>Review Budget</Button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
