"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { FaPiggyBank, FaMoneyCheckAlt, FaUserClock, FaReceipt } from "react-icons/fa";

export default function HomePage() {
  const router = useRouter();
  const [app, setApp] = useState("");
  const [firstName, setFirstName] = useState<string | null>(null);

  // State for dynamic summaries, fallback to default values
  const [savings, setSavings] = useState(1200);
  const [debtRepayment, setDebtRepayment] = useState(3000);
  const [retirementPot, setRetirementPot] = useState(25000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(1900);

  useEffect(() => {
    // Load user profile for firstName
    const savedProfile = localStorage.getItem("userProfile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        if (profile.firstName) {
          setFirstName(profile.firstName);
        }
      } catch {
        // ignore errors
      }
    }

    // Load Savings Goals (example: from localStorage, or elsewhere)
    const savedSavings = localStorage.getItem("savingsGoals");
    if (savedSavings) {
      const val = Number(savedSavings);
      if (!isNaN(val)) setSavings(val);
    }

    // Load Debt Repayment (example)
    const savedDebt = localStorage.getItem("debtRepayment");
    if (savedDebt) {
      const val = Number(savedDebt);
      if (!isNaN(val)) setDebtRepayment(val);
    }

    // Load Retirement Pot
    const savedRetirement = localStorage.getItem("retirementPot");
    if (savedRetirement) {
      const val = Number(savedRetirement);
      if (!isNaN(val)) setRetirementPot(val);
    }

    // Load Monthly Expenses from budget or salary calculator
    // Try budget first
    const savedMonthlyExpenses = localStorage.getItem("monthlyExpenses");
    if (savedMonthlyExpenses) {
      const val = Number(savedMonthlyExpenses);
      if (!isNaN(val)) {
        setMonthlyExpenses(val);
      }
    } else {
      // fallback: try netMonthlySalary from salary calculator
      const savedNetMonthly = localStorage.getItem("netMonthlySalary");
      if (savedNetMonthly) {
        const val = Number(savedNetMonthly);
        if (!isNaN(val)) setMonthlyExpenses(val);
      }
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
  ];

  const getStatus = (pct: number) => {
    if (pct >= 100) return { label: "✅ On Track", color: "text-green-600" };
    if (pct >= 80) return { label: "⚠️ Getting There", color: "text-yellow-600" };
    return { label: "❌ Needs Work", color: "text-red-600" };
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setApp(value);
    if (value) {
      router.push(value);
    }
  };

  const goToProfile = () => {
    router.push("/profile");
  };

  return (
    <main className="p-10 space-y-10 max-w-5xl mx-auto">
      <section>
        <h1 className="text-3xl font-bold mb-4">Welcome to The Spreadsheet</h1>

        {firstName && (
          <p className="text-xl mb-6">Hi, {firstName}!</p>
        )}

        <div className="mb-6 max-w-xs">
          <label htmlFor="app-select" className="block mb-2 font-medium">
            Choose an app to open:
          </label>
          <select
            id="app-select"
            value={app}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Select an app --</option>
            <option value="/budget">Budget App</option>
            <option value="/mortgage">Mortgage Calculator</option>
            <option value="/retirement">Retirement Planner</option>
            <option value="/salary">Net Salary Estimator</option>
            <option value="/goals">Savings & Debt Goals</option>
          </select>
        </div>

        <button
          onClick={goToProfile}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          User Profile
        </button>
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
  );
}
