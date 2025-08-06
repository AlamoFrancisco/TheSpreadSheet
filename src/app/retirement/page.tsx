"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Navbar from "@/components/Navbar"; // ✅ Add this line

// Helper: calculate age from dob string yyyy-mm-dd
function calculateAge(dobStr: string) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function generateProjectionData(
  currentPot: number,
  monthlyContribution: number,
  rate: number,
  months: number
) {
  const monthlyRate = rate / 100 / 12;
  let pot = currentPot;
  const data = [];

  for (let i = 0; i <= months; i++) {
    const year = Math.floor(i / 12);
    if (i > 0) {
      pot = pot * (1 + monthlyRate) + monthlyContribution;
    }
    if (i % 12 === 0 || i === months) {
      data.push({ name: `${year}y`, value: Math.round(pot) });
    }
  }
  return data;
}

export default function RetirementPlanner() {
  const [currentAge, setCurrentAge] = useState<number>(30);
  const [retirementAge, setRetirementAge] = useState(67);
  const [currentPot, setCurrentPot] = useState(20000);
  const [monthlyContribution, setMonthlyContribution] = useState(750);
  const [expectedReturn, setExpectedReturn] = useState(11.1);
  const [goal, setGoal] = useState(500000);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [retirementMonthlySalary, setRetirementMonthlySalary] = useState(2000);

  useEffect(() => {
    const savedProfile = localStorage.getItem("userProfile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        if (profile.dob) {
          const age = calculateAge(profile.dob);
          if (age && age > 0 && age < 120) {
            setCurrentAge(age);
          }
        }
      } catch {}
    }
  }, []);

  const yearsToGrow = retirementAge - currentAge;
  const monthsToGrow = yearsToGrow * 12;
  const monthlyRate = expectedReturn / 100 / 12;
  const inflationAdjRate = inflationRate / 100;

  const futureValue =
    currentPot * Math.pow(1 + monthlyRate, monthsToGrow) +
    monthlyContribution * ((Math.pow(1 + monthlyRate, monthsToGrow) - 1) / monthlyRate);

  const inflationAdjustedGoal = goal * Math.pow(1 + inflationAdjRate, yearsToGrow);
  const adjustedMonthlySalary = retirementMonthlySalary * Math.pow(1 + inflationAdjRate, yearsToGrow);
  const progressPct = (futureValue / inflationAdjustedGoal) * 100;

  const projectionData = generateProjectionData(
    currentPot,
    monthlyContribution,
    expectedReturn,
    monthsToGrow
  );

  return (
    <>
      <Navbar /> {/* ✅ Inject top navigation */}

      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Retirement Planner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="number" placeholder="Current Age" value={currentAge} onChange={(e) => setCurrentAge(Number(e.target.value))} />
            <Input type="number" placeholder="Retirement Age" value={retirementAge} onChange={(e) => setRetirementAge(Number(e.target.value))} />
            <Input type="number" placeholder="Current Pot (£)" value={currentPot} onChange={(e) => setCurrentPot(Number(e.target.value))} />
            <Input type="number" placeholder="Monthly Contribution (£)" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} />
            <Input type="number" placeholder="Expected Annual Return (%)" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} />
            <Input type="number" placeholder="Inflation Rate (%)" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} />
            <Input type="number" placeholder="Retirement Monthly Salary Needed (£)" value={retirementMonthlySalary} onChange={(e) => setRetirementMonthlySalary(Number(e.target.value))} />
            <Input type="number" placeholder="Retirement Goal (£)" value={goal} onChange={(e) => setGoal(Number(e.target.value))} />

            <div className="bg-gray-100 p-4 rounded text-sm space-y-2">
              <div>Years to grow: {yearsToGrow} years</div>
              <div>Monthly Contribution: £{monthlyContribution.toLocaleString()}</div>
              <div>Expected Annual Return: {expectedReturn}%</div>
              <div>Inflation Rate: {inflationRate}%</div>
              <div>Inflation-adjusted Retirement Goal: £{inflationAdjustedGoal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div>Target Monthly Income (adjusted): £{adjustedMonthlySalary.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div>Projected Retirement Pot: £{futureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div className="text-green-700 font-semibold">
                You are at {progressPct.toFixed(0)}% of your retirement target
              </div>
              <Progress value={progressPct} />
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Projection Graph</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={projectionData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    tickFormatter={(value) => `£${value.toLocaleString()}`}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => `£${value.toLocaleString()}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
