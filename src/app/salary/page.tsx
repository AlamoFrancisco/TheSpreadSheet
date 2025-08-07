'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CalcResult = {
  pension: number;
  incomeTax: number;
  nationalInsurance: number;
  netAnnual: number;
  netMonthly: number;
  bandLabel: string;
  bandColor: string;
  effectiveTaxRate: number; // % of gross (tax + NI)
  netWeekly: number;
  netDaily: number;
  netHourly: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function getTaxBand(salaryAfterPension: number) {
  if (salaryAfterPension > 125_140) return { label: 'Very High Earner', color: 'bg-red-600' };
  if (salaryAfterPension > 50_270) return { label: 'Higher Rate Payer', color: 'bg-yellow-500' };
  return { label: 'Basic Rate Payer', color: 'bg-green-600' };
}

function calculateNetSalary(
  salary: number,
  pensionPct: number,
  hoursPerWeek: number
): CalcResult {
  // Approximated UK rules (tweak as needed)
  const personalAllowance = 12_570;
  const basicRateLimit = 50_270;
  const basicRate = 0.20;
  const higherRate = 0.40;
  const additionalRate = 0.45;

  // NI simplified (main rate above threshold)
  const niThreshold = 12_570;
  const niRate = 0.12;

  const pension = Math.max(0, (salary * (pensionPct || 0)) / 100);
  const salaryAfterPension = Math.max(0, salary - pension);

  // PA taper above £100k
  let taperedAllowance = personalAllowance;
  if (salaryAfterPension > 100_000) {
    const reduction = Math.min(personalAllowance, Math.floor((salaryAfterPension - 100_000) / 2));
    taperedAllowance = Math.max(0, personalAllowance - reduction);
  }

  const taxableIncome = Math.max(0, salaryAfterPension - taperedAllowance);

  let incomeTax = 0;
  if (salaryAfterPension <= basicRateLimit) {
    incomeTax = taxableIncome * basicRate;
  } else if (salaryAfterPension <= 125_140) {
    const basicBand = Math.max(0, basicRateLimit - taperedAllowance);
    incomeTax = basicBand * basicRate;
    incomeTax += (salaryAfterPension - basicRateLimit) * higherRate;
  } else {
    const basicBand = Math.max(0, basicRateLimit - taperedAllowance);
    incomeTax = basicBand * basicRate;
    incomeTax += (125_140 - basicRateLimit) * higherRate;
    incomeTax += (salaryAfterPension - 125_140) * additionalRate;
  }

  const ni =
    salaryAfterPension > niThreshold ? (salaryAfterPension - niThreshold) * niRate : 0;

  const netAnnual = Math.max(0, salaryAfterPension - incomeTax - ni);
  const netMonthly = netAnnual / 12;

  // Effective total “drag” vs gross
  const effectiveTaxRate = salary > 0 ? ((incomeTax + ni) / salary) * 100 : 0;

  // Weekly/daily/hourly (52 weeks, 5 days, provided hours/week)
  const netWeekly = netAnnual / 52;
  const netDaily = netWeekly / 5;
  const weeklyHours = clamp(hoursPerWeek || 37.5, 10, 80);
  const netHourly = netWeekly / weeklyHours;

  const bandInfo = getTaxBand(salaryAfterPension);

  return {
    pension,
    incomeTax,
    nationalInsurance: ni,
    netAnnual,
    netMonthly,
    bandLabel: bandInfo.label,
    bandColor: bandInfo.color,
    effectiveTaxRate,
    netWeekly,
    netDaily,
    netHourly,
  };
}

export default function NetSalaryCalculator() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [grossSalary, setGrossSalary] = useState<number>(30_000);
  const [pensionContribution, setPensionContribution] = useState<number>(8);
  const [workHoursFactor, setWorkHoursFactor] = useState<number>(1);
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(37.5); // for hourly calc

  // session + preload salary
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

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('salary')
        .eq('id', uid)
        .single();

      if (!active) return;

      if (profErr && profErr.code !== 'PGRST116') {
        console.error('Profile fetch error:', profErr);
      }

      if (prof?.salary != null) {
        const s = Number(prof.salary);
        if (Number.isFinite(s) && s > 0) setGrossSalary(s);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const adjustedSalary = useMemo(() => {
    const base = Number(grossSalary) || 0;
    const factor = clamp(Number(workHoursFactor) || 0, 0, 1);
    return Math.max(0, base * factor);
  }, [grossSalary, workHoursFactor]);

  const result = useMemo(
    () => calculateNetSalary(adjustedSalary, Number(pensionContribution || 0), hoursPerWeek),
    [adjustedSalary, pensionContribution, hoursPerWeek]
  );

  // Debounced metrics upsert (reduce write spam)
  const upsertTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!userId || loading) return;

    if (upsertTimer.current) clearTimeout(upsertTimer.current);
    upsertTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('metrics').upsert({
        id: userId,
        net_monthly: result.netMonthly,
        net_annual: result.netAnnual,
        pension: result.pension,
        income_tax: result.incomeTax,
        national_insurance: result.nationalInsurance,
        updated_at: new Date().toISOString(),
      });
      if (error) console.error('Metrics upsert error:', error);
    }, 400);

    return () => {
      if (upsertTimer.current) clearTimeout(upsertTimer.current);
    };
  }, [
    userId,
    loading,
    result.netMonthly,
    result.netAnnual,
    result.pension,
    result.incomeTax,
    result.nationalInsurance,
    supabase,
  ]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen p-6 flex items-center justify-center">
          <p>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
    <Navbar />

    <div className="min-h-screen p-6 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        <Card className="shadow-lg rounded-2xl">
          <CardHeader className="flex flex-col items-start gap-2">
            <div className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${result.bandColor}`}>
              {result.bandLabel}
            </div>
            <CardTitle className="text-xl">UK Net Salary Estimator</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Inputs */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="salary">Gross Annual Salary (£)</Label>
                <Input
                  type="number"
                  id="salary"
                  value={Number.isFinite(grossSalary) ? grossSalary : 0}
                  onChange={(e) => setGrossSalary(clamp(Number(e.target.value), 0, 5_000_000))}
                />
              </div>

              <div>
                <Label htmlFor="pension">Pension Contribution (%)</Label>
                <Input
                  type="number"
                  id="pension"
                  value={pensionContribution}
                  onChange={(e) => setPensionContribution(clamp(Number(e.target.value), 0, 100))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workHours">Work Hours Factor (0–1)</Label>
                  <Input
                    type="number"
                    id="workHours"
                    min={0}
                    max={1}
                    step={0.01}
                    value={workHoursFactor}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (!Number.isFinite(val)) val = 0;
                      setWorkHoursFactor(clamp(val, 0, 1));
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">1.00 = full-time, 0.50 = half-time</p>
                </div>

                <div>
                  <Label htmlFor="hpw">Hours per Week</Label>
                  <Input
                    type="number"
                    id="hpw"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(clamp(Number(e.target.value), 10, 80))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for hourly take-home</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-4 rounded-xl shadow">
                <h3 className="font-semibold mb-2">Annual Summary</h3>
                <p><strong>Pension Contribution:</strong> £{result.pension.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Income Tax:</strong> £{result.incomeTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>National Insurance:</strong> £{result.nationalInsurance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Net Annual Salary:</strong> £{result.netAnnual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Effective Tax + NI:</strong> {result.effectiveTaxRate.toFixed(1)}%</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl shadow">
                <h3 className="font-semibold mb-2">Monthly / Weekly / Daily / Hourly</h3>
                <p><strong>Net Monthly:</strong> £{result.netMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Net Weekly:</strong> £{result.netWeekly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Net Daily:</strong> £{result.netDaily.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p><strong>Net Hourly (≈):</strong> £{result.netHourly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </>
  );
}
