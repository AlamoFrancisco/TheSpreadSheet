'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type TabKey = 'essentials' | 'priorities' | 'lifestyle';

type Category = {
  id: string;
  user_id: string;
  name: string;
  type: TabKey;
  monthly_budget: number;
  created_at: string;
  updated_at: string | null;
};

type Tx = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  occurred_on: string; // date
  note: string | null;
  created_at: string;
};

const TAB_LABELS: Record<TabKey, string> = {
  essentials: 'Essentials',
  priorities: 'Priorities',
  lifestyle: 'Lifestyle',
};

const allocationPct = (tab: TabKey) => (tab === 'essentials' ? 0.5 : tab === 'priorities' ? 0.2 : 0.3);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function BudgetApp() {
  const router = useRouter();

  // Auth & loading
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [txByCat, setTxByCat] = useState<Record<string, Tx[]>>({});

  // Salary
  const [salary, setSalary] = useState<number>(0);

  // UI state
  const [currentTab, setCurrentTab] = useState<TabKey>('essentials');
  const [open, setOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatValue, setNewCatValue] = useState('');
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});

  // Quick transaction state
  const [txAmount, setTxAmount] = useState<Record<string, string>>({});
  const [txNote, setTxNote] = useState<Record<string, string>>({});

  // Debouncers for budget edits
  const debouncers = useRef<Record<string, any>>({});

  // Month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

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

      // Prefill salary from metrics.net_monthly; fallback to profiles.salary/12
      const [{ data: met }, { data: prof }] = await Promise.all([
        supabase.from('metrics').select('net_monthly').eq('id', uid).single(),
        supabase.from('profiles').select('salary').eq('id', uid).single(),
      ]);

      const nm = Number(met?.net_monthly ?? 0);
      if (Number.isFinite(nm) && nm > 0) setSalary(nm);
      else {
        const sal = Number(prof?.salary ?? 0);
        if (Number.isFinite(sal) && sal > 0) setSalary(sal / 12);
      }

      // Load categories
      const { data: cats, error: catErr } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      if (catErr) console.error('Fetch categories error:', catErr);
      if (cats) setCategories(cats as Category[]);

      // Load this month's transactions
      const { data: tx, error: txErr } = await supabase
        .from('budget_transactions')
        .select('*')
        .eq('user_id', uid)
        .gte('occurred_on', monthStartStr)
        .lte('occurred_on', monthEndStr)
        .order('occurred_on', { ascending: false });

      if (txErr) console.error('Fetch transactions error:', txErr);
      if (tx) {
        const grouped: Record<string, Tx[]> = {};
        (tx as Tx[]).forEach((t) => {
          (grouped[t.category_id] ||= []).push(t);
        });
        setTxByCat(grouped);
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, monthStartStr, monthEndStr]);

  // Helpers
  const catByTab = (tab: TabKey) => categories.filter((c) => c.type === tab);
  const spentForCat = (catId: string) =>
    (txByCat[catId] || []).reduce((s, t) => s + Number(t.amount || 0), 0);

  const totalsByTab = useMemo(() => {
    const obj: Record<TabKey, { budget: number; spend: number }> = {
      essentials: { budget: 0, spend: 0 },
      priorities: { budget: 0, spend: 0 },
      lifestyle: { budget: 0, spend: 0 },
    };
    for (const c of categories) {
      obj[c.type].budget += Number(c.monthly_budget || 0);
      obj[c.type].spend += spentForCat(c.id);
    }
    return obj;
  }, [categories, txByCat]);

  const overallBudget = useMemo(
    () => categories.reduce((s, c) => s + Number(c.monthly_budget || 0), 0),
    [categories]
  );
  const overallSpend = useMemo(
    () => Object.values(txByCat).flat().reduce((s, t) => s + Number(t.amount || 0), 0),
    [txByCat]
  );
  const remaining = salary - overallBudget;

  // Create category
  const saveNewCategory = async () => {
    if (!userId) return;
    const name = newCatName.trim();
    const value = Number(newCatValue);
    if (!name || !Number.isFinite(value) || value < 0) {
      alert('Please enter a valid name and value (>= 0)');
      return;
    }
    // optimistic
    const temp: Category = {
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      type: currentTab,
      monthly_budget: value,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    setCategories((prev) => [...prev, temp]);

    const { data, error } = await supabase
      .from('budget_categories')
      .insert({
        user_id: userId,
        name,
        type: currentTab,
        monthly_budget: value,
      })
      .select('*')
      .single();

    if (error || !data) {
      setCategories((prev) => prev.filter((c) => c.id !== temp.id));
      console.error('Insert category error:', error);
      alert('Failed to add category.');
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === temp.id ? (data as Category) : c)));
    setNewCatName('');
    setNewCatValue('');
    setOpen(false);
  };

  // Update category budget (debounced)
  const updateBudget = (cat: Category) => {
    const raw = valueInputs[cat.id];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      alert('Enter a valid non-negative amount');
      return;
    }
    // optimistic
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, monthly_budget: amount } : c)));
    setValueInputs((prev) => ({ ...prev, [cat.id]: '' }));

    if (debouncers.current[cat.id]) clearTimeout(debouncers.current[cat.id]);
    debouncers.current[cat.id] = setTimeout(async () => {
      const { error } = await supabase
        .from('budget_categories')
        .update({ monthly_budget: amount })
        .eq('id', cat.id)
        .eq('user_id', userId!);
      if (error) {
        console.error('Update budget error:', error);
        alert('Failed to update budget.');
      }
    }, 350);
  };

  // Delete category
  const deleteCategory = async (catId: string) => {
    const prev = categories;
    setCategories((c) => c.filter((x) => x.id !== catId));
    const { error } = await supabase.from('budget_categories').delete().eq('id', catId).eq('user_id', userId!);
    if (error) {
      console.error('Delete category error:', error);
      alert('Failed to delete category.');
      setCategories(prev);
    } else {
      setTxByCat((prevTx) => {
        const copy = { ...prevTx };
        delete copy[catId];
        return copy;
      });
    }
  };

  // Add a quick expense transaction to a category
  const addTx = async (cat: Category) => {
    if (!userId) return;
    const amt = Number(txAmount[cat.id]);
    const note = (txNote[cat.id] || '').trim() || null;
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Enter a valid amount.');
      return;
    }

    // optimistic
    const temp: Tx = {
      id: crypto.randomUUID(),
      user_id: userId,
      category_id: cat.id,
      amount: amt,
      occurred_on: new Date().toISOString().slice(0, 10),
      note,
      created_at: new Date().toISOString(),
    };
    setTxByCat((prev) => ({ ...prev, [cat.id]: [temp, ...(prev[cat.id] || [])] }));

    const { data, error } = await supabase
      .from('budget_transactions')
      .insert({
        category_id: cat.id,
        amount: amt,
        note,
        occurred_on: temp.occurred_on,
        user_id: userId, // filled by trigger
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('Insert transaction error:', error);
      // rollback
      setTxByCat((prev) => ({
        ...prev,
        [cat.id]: (prev[cat.id] || []).filter((t) => t.id !== temp.id),
      }));
      alert('Failed to add transaction.');
      return;
    }

    // replace temp with server row
    setTxByCat((prev) => ({
      ...prev,
      [cat.id]: [data as Tx, ...(prev[cat.id] || []).filter((t) => t.id !== temp.id)],
    }));
    setTxAmount((prev) => ({ ...prev, [cat.id]: '' }));
    setTxNote((prev) => ({ ...prev, [cat.id]: '' }));
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">Loading…</div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 gap-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-bold"
        >
          My Budget
        </motion.h1>

        {/* Salary & 50/30/20 overview */}
        <Card className="w-full max-w-3xl shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Monthly Income & 50/30/20</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-700">
              Net Monthly Income: £{salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              {(['essentials', 'lifestyle', 'priorities'] as TabKey[]).map((tab) => {
                const alloc = salary * allocationPct(tab);
                const spend = totalsByTab[tab].spend;
                // If you prefer comparing "budget" not "spend", switch to totalsByTab[tab].budget
                return (
                  <div key={tab} className="bg-white rounded-xl p-3 shadow">
                    <div className="font-medium">{TAB_LABELS[tab]}</div>
                    <div>Suggested Budget: £{alloc.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({(allocationPct(tab) * 100).toFixed(0)}%)</div>
                    <div>Planned Budget: £{totalsByTab[tab].budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div>Spent (this month): £{spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <Progress value={alloc ? Math.min(100, (spend / alloc) * 100) : 0} />
                  </div>
                );
              })}
            </div>

            <div className="text-sm text-gray-600">
              Sum of category budgets: £{overallBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })} | Remaining vs income: £
              {(salary - overallBudget).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as TabKey)} className="w-full max-w-3xl">
          <TabsList className="grid grid-cols-3 mb-4 bg-white shadow rounded-2xl">
            <TabsTrigger value="essentials">Essentials (50%)</TabsTrigger>
            <TabsTrigger value="priorities">Priorities (20%)</TabsTrigger>
            <TabsTrigger value="lifestyle">Lifestyle (30%)</TabsTrigger>
          </TabsList>

          {(['essentials', 'priorities', 'lifestyle'] as TabKey[]).map((tab) => {
            const cats = catByTab(tab);
            const budgetSum = cats.reduce((s, c) => s + Number(c.monthly_budget || 0), 0);
            const spendSum = cats.reduce((s, c) => s + spentForCat(c.id), 0);
            const suggested = salary * allocationPct(tab);

            return (
              <TabsContent key={tab} value={tab} className="space-y-6">
                <Card className="shadow-xl rounded-2xl">
                  <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-xl capitalize">{TAB_LABELS[tab]} Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>Suggested: £{suggested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div>Planned Budget: £{budgetSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-2">Spent (this month): £{spendSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-2">
                      <Progress value={suggested ? Math.min(100, (spendSum / suggested) * 100) : 0} />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cats.map((cat) => {
                    const spent = spentForCat(cat.id);
                    const leftVsPlanned = Math.max(0, Number(cat.monthly_budget || 0) - spent);

                    return (
                      <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                        <Card className="shadow-lg rounded-2xl">
                          <CardHeader>
                            <CardTitle>{cat.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span>Planned Budget</span>
                              <span>£{Number(cat.monthly_budget || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Spent (this month)</span>
                              <span>£{spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>Left vs Planned</span>
                              <span>£{leftVsPlanned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            {/* Edit planned budget */}
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                placeholder="New planned budget"
                                className="flex-1"
                                value={valueInputs[cat.id] ?? ''}
                                onChange={(e) => setValueInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                              />
                              <Button size="sm" onClick={() => updateBudget(cat)}>
                                Update
                              </Button>
                            </div>

                            {/* Quick expense add */}
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                placeholder="Add expense"
                                className="flex-1"
                                value={txAmount[cat.id] ?? ''}
                                onChange={(e) => setTxAmount((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                              />
                              <Input
                                type="text"
                                placeholder="Note (optional)"
                                className="flex-1"
                                value={txNote[cat.id] ?? ''}
                                onChange={(e) => setTxNote((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                              />
                              <Button size="sm" onClick={() => addTx(cat)}>
                                Add
                              </Button>
                            </div>

                            <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteCategory(cat.id)}>
                              Delete Category
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Add Category */}
                <Card className="shadow-xl rounded-2xl">
                  <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-lg">Add {TAB_LABELS[tab]} Category</CardTitle>
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">Add Category</Button>
                      </DialogTrigger>
                      <DialogContent className="space-y-4">
                        <DialogHeader>
                          <DialogTitle>New {TAB_LABELS[tab]} Category</DialogTitle>
                        </DialogHeader>
                        <Input placeholder="Category name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                        <Input
                          type="number"
                          placeholder="Planned budget"
                          value={newCatValue}
                          onChange={(e) => setNewCatValue(e.target.value)}
                        />
                        <DialogFooter>
                          <Button onClick={saveNewCategory}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </>
  );
}
