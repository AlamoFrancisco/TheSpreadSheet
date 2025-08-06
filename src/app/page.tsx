"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  FaPiggyBank,
  FaMoneyCheckAlt,
  FaUserClock,
  FaReceipt,
  FaHome,
} from "react-icons/fa";
import Navbar from "@/components/Navbar"; // ✅ Add the navbar

export default function HomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);

  const [savings, setSavings] = useState(1200);
  const [debtRepayment, setDebtRepayment] = useState(3000);
  const [retirementPot, setRetirementPot] = useState(25000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(1900);
  const [monthlyMortgage, setMonthlyMortgage] = useState(1000);

  useEffect(() => {
    const savedProfile = localStorage.getItem("userProfile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        if (profile.firstName) {
          setFirstName(profile.firstName);
        }
      } catch {}
    }

    const savedSavings = localStorage.getItem("savingsGoals");
    if (savedSavings) {
      const val = Number(savedSavings);
      if (!isNaN(val)) setSavings(val);
    }

    const savedDebt = localStorage.getItem("debtRepayment");
    if (savedDebt) {
      const val = Number(savedDebt);
      if (!isNaN(val)) setDebtRepayment(val);
    }

    const savedRetirement = localStorage.getItem("retirementPot");
    if (savedRetirement) {
      const val = Number(savedRetirement);
      if (!isNaN(val)) setRetirementPot(val);
    }

    const savedMonthlyExpenses = localStorage.getItem("monthlyExpenses");
    if (savedMonthlyExpenses) {
      const val = Number(savedMonthlyExpenses);
      if (!isNaN(val)) {
        setMonthlyExpenses(val);
      }
    } else {
      const savedNetMonthly = localStorage.getItem("netMonthlySalary");
      if (savedNetMonthly) {
        const val = Number(savedNetMonthly);
        if (!isNaN(val)) setMonthlyExpenses(val);
      }
    }

    const savedMortgage = localStorage.getItem("monthlyMortgage");
    if (savedMortgage) {
      const val = Number(savedMortgage);
      if (!isNaN(val)) setMonthlyMortgage(val);
    }
  }, []);

  const summaries = [
    {
      title: "Savings Goals",
      current: savings,
      target: 2000,
      icon: <FaPiggyBank className="text-pink-500 text-xl" />,
    },
    {
      title: "Debt Repayment",
      current: debtRepayment,
      target: 5000,
      icon: <FaMoneyCheckAlt className="text-green-500 text-xl" />,
    },
    {
      title: "Retirement Pot",
      current: retirementPot,
      target: 500000,
      icon: <FaUserClock className="text-blue-500 text-xl" />,
    },
    {
      title: "Monthly Expenses",
      current: monthlyExpenses,
      target: 2000,
      icon: <FaReceipt className="text-yellow-500 text-xl" />,
    },
    {
      title: "Mortgage",
      current: monthlyMortgage,
      target: 1200,
      icon: <FaHome className="text-indigo-500 text-xl" />,
    },
  ];

  const getStatus = (pct: number) => {
    if (pct >= 100) return { label: "✅ On Track", color: "text-green-600" };
    if (pct >= 80) return { label: "⚠️ Getting There", color: "text-yellow-600" };
    return { label: "❌ Needs Work", color: "text-red-600" };
  };

  return (
    <>
      <Navbar /> {/* ✅ Inject top navigation */}

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
                      <div className={`font-medium ${status.color}`}>Status: {status.label}</div>
                      <Progress value={Math.min(pct, 100)} />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
