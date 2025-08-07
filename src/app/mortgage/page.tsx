"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// --- helpers ---
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmt = (n: number, dp = 2) =>
  `£${Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "0.00"}`;

function monthlyPayment(loan: number, annualRate: number, years: number) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return loan / n;
  const f = Math.pow(1 + r, n);
  return (loan * r * f) / (f - 1);
}

function buildAmortization(
  loan: number,
  annualRate: number,
  years: number,
  monthlyOverpay: number
) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const basePay = monthlyPayment(loan, annualRate, years);
  const pay = basePay + monthlyOverpay;

  let bal = loan;
  const rows: { year: number; Principal: number; Interest: number }[] = [];
  let month = 0;

  while (bal > 0 && month < n + 600) {
    month++;
    const yearIndex = Math.ceil(month / 12) - 1;
    const interest = bal * r;
    let principal = pay - interest;

    // If the last payment would overshoot, cap to remaining balance
    if (principal > bal) {
      principal = bal;
    }
    bal = Math.max(0, bal - principal);

    if (!rows[yearIndex]) rows[yearIndex] = { year: yearIndex + 1, Principal: 0, Interest: 0 };
    rows[yearIndex].Principal += principal;
    rows[yearIndex].Interest += interest;

    // Safety break if payment can't cover interest (degenerate input)
    if (pay <= interest && r > 0) break;
  }

  // Round
  return rows.map((x) => ({
    year: x.year,
    Principal: Number(x.Principal.toFixed(2)),
    Interest: Number(x.Interest.toFixed(2)),
  }));
}

export default function MortgageCalculator() {
  // Prefill salary from profiles
  const [householdIncome, setHouseholdIncome] = useState<number>(0);
  const [incomeMultiple, setIncomeMultiple] = useState<number>(4.5);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("profiles").select("salary").eq("id", session.user.id).single();
      if (!active) return;
      const salary = Number(data?.salary);
      if (Number.isFinite(salary) && salary > 0) setHouseholdIncome(salary);
    })();
    return () => { active = false; };
  }, []);

  // Inputs
  const [housePrice, setHousePrice] = useState(300_000);
  const [depositPct, setDepositPct] = useState(10);
  const [interestRate, setInterestRate] = useState(4.5);
  const [loanYears, setLoanYears] = useState(25);

  const [fees, setFees] = useState<number>(1500); // arrangement+legal approx
  const [monthlyOverpay, setMonthlyOverpay] = useState<number>(0);
  const [stressAdd, setStressAdd] = useState<number>(1.0); // extra % for stress test

  // Derived
  const depositPctClamped = clamp(depositPct, 0, 95);
  const depositAmount = (housePrice * depositPctClamped) / 100;
  const loanAmount = Math.max(0, housePrice - depositAmount);
  const ltv = loanAmount > 0 ? (loanAmount / housePrice) * 100 : 0;

  const monthlyPay = monthlyPayment(loanAmount, interestRate, loanYears);
  const monthlyPayStress = monthlyPayment(loanAmount, interestRate + stressAdd, loanYears);
  const monthlyTotalWithOverpay = monthlyPay + monthlyOverpay;

  const amortizationData = useMemo(
    () => buildAmortization(loanAmount, interestRate, loanYears, monthlyOverpay),
    [loanAmount, interestRate, loanYears, monthlyOverpay]
  );

  const totalPayments = amortizationData.reduce((sum, y) => sum + y.Principal + y.Interest, 0);
  const totalInterest = amortizationData.reduce((sum, y) => sum + y.Interest, 0);

  // Affordability metrics
  const incomeMonthly = householdIncome > 0 ? householdIncome / 12 : 0;
  const paymentToIncome = incomeMonthly > 0 ? (monthlyTotalWithOverpay / incomeMonthly) * 100 : 0;

  const maxLoanByIncomeMultiple = Math.max(0, householdIncome * incomeMultiple - fees);
  const maxPriceByIncomeMultiple = maxLoanByIncomeMultiple + depositAmount; // assumes same deposit cash
  const idealHouseholdSalary = monthlyPay * 12 * 3.6; // your original heuristic

  return (
    <>
      <Navbar />

      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Mortgage Calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Price & deposit */}
            <div>
              <label className="block mb-2 font-medium">House Price</label>
              <Input
                type="number"
                value={housePrice}
                onChange={(e) => setHousePrice(clamp(Number(e.target.value), 0, 10_000_000))}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">
                Deposit Percentage ({depositPctClamped}%)
              </label>
              <Slider min={0} max={95} step={1} value={[depositPctClamped]} onValueChange={([v]) => setDepositPct(v)} />
              <div className="text-xs text-gray-600 mt-1">
                Deposit: {fmt(depositAmount, 0)} · LTV: {ltv.toFixed(1)}%
              </div>
            </div>

            {/* Rate, years, fees, overpay, stress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">
                  Annual Interest Rate ({interestRate}%)
                </label>
                <Slider min={0} max={10} step={0.1} value={[interestRate]} onValueChange={([v]) => setInterestRate(v)} />
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Duration ({loanYears} years)
                </label>
                <Slider min={1} max={40} step={1} value={[loanYears]} onValueChange={([v]) => setLoanYears(v)} />
              </div>

              <div>
                <label className="block mb-2 font-medium">Fees (arrangement + legal)</label>
                <Input
                  type="number"
                  value={fees}
                  onChange={(e) => setFees(clamp(Number(e.target.value), 0, 100_000))}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Monthly Overpayment</label>
                <Input
                  type="number"
                  value={monthlyOverpay}
                  onChange={(e) => setMonthlyOverpay(clamp(Number(e.target.value), 0, 100_000))}
                />
                <p className="text-xs text-gray-600 mt-1">Overpayments shorten the term and slash interest.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block mb-1 font-medium">Stress Test (+{stressAdd.toFixed(1)}%)</label>
                <Slider min={0} max={5} step={0.1} value={[stressAdd]} onValueChange={([v]) => setStressAdd(v)} />
                <div className="text-xs text-gray-600 mt-1">
                  Monthly @ stress rate: <strong>{fmt(monthlyPayStress)}</strong>
                </div>
              </div>
            </div>

            {/* Income + affordability */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium">Household Gross Annual Income</label>
                <Input
                  type="number"
                  value={householdIncome}
                  onChange={(e) => setHouseholdIncome(clamp(Number(e.target.value), 0, 5_000_000))}
                />
                <p className="text-xs text-gray-600">
                  Prefilled from your profile salary if available.
                </p>
              </div>

              <div>
                <label className="block mb-2 font-medium">Income Multiple</label>
                <Input
                  type="number"
                  value={incomeMultiple}
                  onChange={(e) => setIncomeMultiple(clamp(Number(e.target.value), 1, 10))}
                />
                <p className="text-xs text-gray-600">
                  Typical lender multiples range ~4–5× (varies).
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-2 p-4 bg-gray-100 rounded-lg text-sm space-y-2">
              <div>Total Price: {fmt(housePrice, 0)}</div>
              <div>Deposit: {fmt(depositAmount, 0)} · Fees: {fmt(fees, 0)}</div>
              <div>Loan Amount: {fmt(loanAmount, 0)} · LTV: {ltv.toFixed(1)}%</div>

              <div className="text-lg font-bold">
                Monthly Payment: {fmt(monthlyPay)}
                {monthlyOverpay > 0 && (
                  <> (+ overpay {fmt(monthlyOverpay, 0)} = <span className="font-semibold">{fmt(monthlyPay + monthlyOverpay)}</span>)</>
                )}
              </div>

              <div className="font-medium">
                Total Interest Paid: {fmt(totalInterest)}
              </div>
              <div className="font-semibold">
                Total Cost (Loan + Interest): {fmt(totalPayments)}
              </div>

              <div className="font-medium text-green-700">
                Ideal Household Annual Salary (heuristic): {fmt(idealHouseholdSalary)}
              </div>

              {householdIncome > 0 && (
                <>
                  <div>
                    Payment-to-Income: <strong>{paymentToIncome.toFixed(1)}%</strong> of gross monthly
                  </div>
                  <div>
                    Max Purchase by Income Multiple: <strong>{fmt(maxPriceByIncomeMultiple, 0)}</strong>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-lg">Annual Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={amortizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(val) => `£${Math.round(val).toLocaleString()}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Principal" stackId="a" fill="#06b6d4" />
                <Bar dataKey="Interest" stackId="a" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
