'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

// Helpers
function calculateAgeFromDob(dobStr?: string | null) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function generateProjectionData(
  startingPot: number,
  monthlyContribution: number,
  nominalReturnPct: number,
  annualFeesPct: number,
  months: number
) {
  const monthlyGross = nominalReturnPct / 100 / 12;
  const monthlyFees = annualFeesPct / 100 / 12;
  const monthlyNet = Math.max(-1, monthlyGross - monthlyFees); // guard
  let pot = startingPot;
  const data: { name: string; pot: number }[] = [];

  for (let i = 0; i <= months; i++) {
    if (i > 0) pot = pot * (1 + monthlyNet) + monthlyContribution;
    if (i % 12 === 0 || i === months) {
      data.push({ name: `${Math.floor(i / 12)}y`, pot: Math.max(0, Math.round(pot)) });
    }
  }
  return data;
}

export default function RetirementPlanner() {
  // Auth + prefill
  const [loading, setLoading] = useState(true);
  const [prefillAge, setPrefillAge] = useState<number | null>(null);
  const [prefillPot, setPrefillPot] = useState<number | null>(null);

  // Inputs (user-editable)
  const [currentAge, setCurrentAge] = useState<number>(30);
  const [retirementAge, setRetirementAge] = useState<number>(67);
  const [currentPot, setCurrentPot] = useState<number>(20000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(750);
  const [expectedReturn, setExpectedReturn] = useState<number>(7);   // nominal %
  const [inflationRate, setInflationRate] = useState<number>(2.5);   // %
  const [annualFees, setAnnualFees] = useState<number>(0.5);         // %
  const [employerMatchPct, setEmployerMatchPct] = useState<number>(3); // % of salary contrib
  const [retirementMonthlyIncomeNeed, setRetirementMonthlyIncomeNeed] = useState<number>(2000);
  const [goal, setGoal] = useState<number>(500000);

  // Prefill from Supabase: profiles(dob), metrics(retirement_pot)
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;

      const [{ data: prof }, { data: metrics, error: metricsErr }] = await Promise.all([
        supabase.from('profiles').select('dob').eq('id', uid).single(),
        supabase.from('metrics').select('retirement_pot').eq('id', uid).single(),
      ]);

      if (!active) return;

      const age = calculateAgeFromDob(prof?.dob);
      if (age && age > 0 && age < 120) {
        setPrefillAge(age);
        setCurrentAge((prev) => (prev !== 30 ? prev : age)); // only override default
      }

      if (!metricsErr && typeof metrics?.retirement_pot === 'number') {
        setPrefillPot(metrics.retirement_pot);
        setCurrentPot((prev) => (prev !== 20000 ? prev : Number(metrics.retirement_pot)));
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Real (inflation-adjusted) return approximation
  const realReturn = useMemo(() => {
    const r = (1 + (expectedReturn || 0) / 100) / (1 + (inflationRate || 0) / 100) - 1;
    return r * 100; // %
  }, [expectedReturn, inflationRate]);

  const yearsToGrow = Math.max(0, (retirementAge || 0) - (currentAge || 0));
  const monthsToGrow = yearsToGrow * 12;

  // Add employer match to monthly contributions (simple approximation)
  const totalMonthlyContrib = Math.max(
    0,
    Number(monthlyContribution || 0) * (1 + Number(employerMatchPct || 0) / 100)
  );

  // Project with nominal minus fees (not double-subtracting inflation here; we use real return for target comparison)
  const projectionData = useMemo(
    () =>
      generateProjectionData(
        Number(currentPot || 0),
        totalMonthlyContrib,
        Number(expectedReturn || 0),
        Number(annualFees || 0),
        monthsToGrow
      ),
    [currentPot, totalMonthlyContrib, expectedReturn, annualFees, monthsToGrow]
  );

  const projectedPotNominal =
    projectionData.length ? projectionData[projectionData.length - 1].pot : Number(currentPot || 0);

  // Compare to an inflation-adjusted goal/income need using REAL return (purchasing power)
  const inflationAdjGoal = goal * Math.pow(1 + (inflationRate || 0) / 100, yearsToGrow);
  const inflationAdjMonthlyNeed =
    retirementMonthlyIncomeNeed * Math.pow(1 + (inflationRate || 0) / 100, yearsToGrow);

  // Convert nominal projected pot -> approximate real pot by deflating with inflation
  const projectedPotReal =
    projectedPotNominal / Math.pow(1 + (inflationRate || 0) / 100, yearsToGrow);

  const progressPct = Math.max(
    0,
    Math.min(100, (projectedPotReal / (inflationAdjGoal || Infinity)) * 100)
  );

  // Sustainable withdrawal (very rough) 3.5% rule
  const sustainableAnnualReal = projectedPotReal * 0.035;
  const sustainableMonthlyReal = sustainableAnnualReal / 12;
  const incomeGapMonthly = sustainableMonthlyReal - inflationAdjMonthlyNeed;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center p-6">
          <p>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="min-h-screen flex flex-col items-center p-6 gap-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Retirement Planner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prefill hints */}
            {(prefillAge || prefillPot) && (
              <div className="text-xs text-gray-500">
                {prefillAge ? `Age auto-filled from profile DOB (${prefillAge}). ` : ''}
                {prefillPot ? `Pot prefilled from metrics (${prefillPot.toLocaleString()}).` : ''}
              </div>
            )}

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Current Age"
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Retirement Age"
                value={retirementAge}
                onChange={(e) => setRetirementAge(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Current Pot (£)"
                value={currentPot}
                onChange={(e) => setCurrentPot(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Monthly Contribution (£)"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Employer Match (%)"
                value={employerMatchPct}
                onChange={(e) => setEmployerMatchPct(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Expected Annual Return (%)"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Annual Fees (%)"
                value={annualFees}
                onChange={(e) => setAnnualFees(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Inflation Rate (%)"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Retirement Monthly Income Need (£)"
                value={retirementMonthlyIncomeNeed}
                onChange={(e) => setRetirementMonthlyIncomeNeed(Number(e.target.value))}
              />
              <Input
                type="number"
                placeholder="Retirement Goal (£)"
                value={goal}
                onChange={(e) => setGoal(Number(e.target.value))}
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-100 p-4 rounded text-sm space-y-2">
              <div>Years to grow: {yearsToGrow} years</div>
              <div>Total Monthly Contribution (incl. match): £{totalMonthlyContrib.toLocaleString()}</div>
              <div>Expected (nominal) return: {expectedReturn}%  | Annual fees: {annualFees}%</div>
              <div>Approx. real return (net of inflation): {realReturn.toFixed(2)}%</div>

              <div>Inflation-adjusted Retirement Goal: £{inflationAdjGoal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div>Target Monthly Income at Retirement (inflation-adjusted): £{inflationAdjMonthlyNeed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

              <div>Projected Pot (nominal): £{projectedPotNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div>Projected Pot (real): £{projectedPotReal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

              <div className={incomeGapMonthly >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                {incomeGapMonthly >= 0
                  ? `Surplus vs need: £${incomeGapMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`
                  : `Shortfall vs need: £${Math.abs(incomeGapMonthly).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`}
              </div>

              <div className="text-gray-700">
                Progress toward inflation-adjusted pot goal:
              </div>
              <div className="text-green-700 font-semibold">{progressPct.toFixed(0)}%</div>
              <Progress value={progressPct} />
            </div>

            {/* Chart */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Projection (nominal) </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={projectionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `£${v.toLocaleString()}`} width={90} />
                  <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="pot" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
