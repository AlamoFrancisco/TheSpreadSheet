'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  FaPiggyBank,
  FaMoneyCheckAlt,
  FaUserClock,
  FaReceipt,
  FaHome,
} from 'react-icons/fa';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [savings, setSavings] = useState(0);
  const [debtRepayment, setDebtRepayment] = useState(0);
  const [retirementPot, setRetirementPot] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [monthlyMortgage, setMonthlyMortgage] = useState(0);

  useEffect(() => {
    let mounted = true;

    const fetchUserData = async (userId: string) => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', userId)
        .single();

      if (profileError) console.error('Profile fetch error:', profileError);
      if (profile?.first_name) setFirstName(profile.first_name);

      const { data: metrics, error: metricsError } = await supabase
        .from('metrics')
        .select(
          'savings, debt_repayment, retirement_pot, monthly_expenses, monthly_mortgage'
        )
        .eq('id', userId)
        .single();

      if (metricsError) console.error('Metrics fetch error:', metricsError);
      if (metrics) {
        setSavings(Number(metrics.savings) || 0);
        setDebtRepayment(Number(metrics.debt_repayment) || 0);
        setRetirementPot(Number(metrics.retirement_pot) || 0);
        setMonthlyExpenses(Number(metrics.monthly_expenses) || 0);
        setMonthlyMortgage(Number(metrics.monthly_mortgage) || 0);
      }

      if (mounted) setLoading(false);
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            fetchUserData(session.user.id);
          } else if (event === 'SIGNED_OUT') {
            router.replace('/login');
          }
        });

        return () => listener?.subscription.unsubscribe();
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  const summaries = [
    {
      title: 'Savings Goals',
      current: savings,
      target: 2000,
      icon: <FaPiggyBank className="text-pink-500 text-xl" />,
    },
    {
      title: 'Debt Repayment',
      current: debtRepayment,
      target: 5000,
      icon: <FaMoneyCheckAlt className="text-green-500 text-xl" />,
    },
    {
      title: 'Retirement Pot',
      current: retirementPot,
      target: 500000,
      icon: <FaUserClock className="text-blue-500 text-xl" />,
    },
    {
      title: 'Monthly Expenses',
      current: monthlyExpenses,
      target: 2000,
      icon: <FaReceipt className="text-yellow-500 text-xl" />,
    },
    {
      title: 'Mortgage',
      current: monthlyMortgage,
      target: 1200,
      icon: <FaHome className="text-indigo-500 text-xl" />,
    },
  ];

  const getStatus = (pct: number) => {
    if (pct >= 100) return { label: '✅ On Track', color: 'text-green-600' };
    if (pct >= 80) return { label: '⚠️ Getting There', color: 'text-yellow-600' };
    return { label: '❌ Needs Work', color: 'text-red-600' };
  };

  return (
    <>
      <Navbar />
      <main className="p-10 space-y-10 max-w-5xl mx-auto">
        <section>
          <h1 className="text-3xl font-bold mb-4">Welcome to The Spreadsheet</h1>
          {firstName && <p className="text-xl mb-6">Hi, {firstName}!</p>}
        </section>

        <section>
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold mb-8 flex items-center gap-2"
          >
            <span role="img" aria-label="chart">📊</span> Smart Budgeting Overview
          </motion.h2>

          {loading ? (
            <p>Loading your data...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {summaries.map((summary, idx) => {
                const pct = (summary.current / summary.target) * 100;
                const status = getStatus(pct);

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="shadow-xl rounded-2xl">
                      <CardHeader className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {summary.icon} {summary.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <div>Current: £{summary.current.toLocaleString()}</div>
                        <div>Target: £{summary.target.toLocaleString()}</div>
                        <div className={`font-medium ${status.color}`}>
                          Status: {status.label}
                        </div>
                        <Progress value={Math.min(pct, 100)} />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
