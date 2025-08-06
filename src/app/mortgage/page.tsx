"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Navbar from "@/components/Navbar"; // ✅ Import Navbar

function calculateMonthlyPayment(loanAmount: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  return (
    loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

function getAmortizationData(loanAmount: number, annualRate: number, years: number) {
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, years);
  let balance = loanAmount;
  const data = [];

  for (let i = 1; i <= months; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;
    const year = Math.ceil(i / 12);

    if (!data[year - 1]) {
      data[year - 1] = { year, principal: 0, interest: 0 };
    }
    data[year - 1].principal += principal;
    data[year - 1].interest += interest;
  }

  return data.map((item) => ({
    year: item.year,
    Principal: Number(item.principal.toFixed(2)),
    Interest: Number(item.interest.toFixed(2)),
  }));
}

export default function MortgageCalculator() {
  const [housePrice, setHousePrice] = useState(300000);
  const [depositPct, setDepositPct] = useState(5);
  const [interestRate, setInterestRate] = useState(2);
  const [loanYears, setLoanYears] = useState(25);

  const depositAmount = (housePrice * depositPct) / 100;
  const loanAmount = housePrice - depositAmount;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, loanYears);
  const amortizationData = getAmortizationData(loanAmount, interestRate, loanYears);

  const totalPayments = monthlyPayment * loanYears * 12;
  const totalInterest = totalPayments - loanAmount;
  const idealSalary = monthlyPayment * 12 * 3.6;

  return (
    <>
      <Navbar /> {/* ✅ Add top navigation */}

      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Mortgage Calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block mb-2 font-medium">House Price</label>
              <Input
                type="number"
                value={housePrice}
                onChange={(e) => setHousePrice(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">
                Percentage of the deposit ({depositPct}%)
              </label>
              <Slider min={5} max={75} step={1} value={[depositPct]} onValueChange={([val]) => setDepositPct(val)} />
            </div>

            <div>
              <label className="block mb-1 font-medium">
                Annual interest rate ({interestRate}%)
              </label>
              <Slider min={2} max={6} step={0.1} value={[interestRate]} onValueChange={([val]) => setInterestRate(val)} />
            </div>

            <div>
              <label className="block mb-1 font-medium">
                Duration of the loan ({loanYears} years)
              </label>
              <Slider min={1} max={30} step={1} value={[loanYears]} onValueChange={([val]) => setLoanYears(val)} />
            </div>

            <div className="mt-6 p-4 bg-gray-100 rounded-lg text-sm space-y-2">
              <div>Total Price of House: £{housePrice.toLocaleString()}</div>
              <div>
                Initial deposit percentage: {depositPct}% ( £{depositAmount.toLocaleString()} )
              </div>
              <div>Annual interest rate: {interestRate}%</div>
              <div>
                Term: {loanYears} years ({(loanYears * 12).toLocaleString()} months)
              </div>
              <div className="text-lg font-bold">
                Monthly payment: £{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="font-medium text-green-700">
                Ideal Household Annual Salary: £{idealSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="font-semibold">
                Total cost to be paid: £{loanAmount.toLocaleString()} (Loan) + £{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })} (interest) = £{totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-lg">Annual Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={amortizationData} stackOffset="expand">
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value) => `£${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
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
