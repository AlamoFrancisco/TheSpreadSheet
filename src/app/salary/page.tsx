"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar"; // ✅ Add top nav

const getTaxBand = (salaryAfterPension: number) => {
  if (salaryAfterPension > 125140) return { label: "Very High Earner", color: "bg-red-600" };
  if (salaryAfterPension > 50270) return { label: "Higher Rate Payer", color: "bg-yellow-500" };
  return { label: "Basic Rate Payer", color: "bg-green-600" };
};

export default function NetSalaryCalculator() {
  const [grossSalary, setGrossSalary] = useState(30000);
  const [pensionContribution, setPensionContribution] = useState(8);
  const [workHoursFactor, setWorkHoursFactor] = useState(1);

  useEffect(() => {
    const savedProfile = localStorage.getItem("userProfile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        if (profile.salary) {
          const salaryNum = Number(profile.salary);
          if (!isNaN(salaryNum) && salaryNum > 0) {
            setGrossSalary(salaryNum);
          }
        }
      } catch {}
    }
  }, []);

  const calculateNetSalary = (salary: number, pensionPct: number) => {
    const personalAllowance = 12570;
    const basicRateLimit = 50270;
    const basicRate = 0.2;
    const higherRate = 0.4;
    const additionalRate = 0.45;
    const niThreshold = 12570;
    const niRate = 0.12;

    const pension = (salary * pensionPct) / 100;
    const salaryAfterPension = salary - pension;

    let taxableIncome = Math.max(0, salaryAfterPension - personalAllowance);
    let incomeTax = 0;

    if (salaryAfterPension <= basicRateLimit) {
      incomeTax = taxableIncome * basicRate;
    } else if (salaryAfterPension <= 125140) {
      incomeTax = (basicRateLimit - personalAllowance) * basicRate;
      incomeTax += (salaryAfterPension - basicRateLimit) * higherRate;
    } else {
      incomeTax = (basicRateLimit - personalAllowance) * basicRate;
      incomeTax += (125140 - basicRateLimit) * higherRate;
      incomeTax += (salaryAfterPension - 125140) * additionalRate;
    }

    const ni = salaryAfterPension > niThreshold ? (salaryAfterPension - niThreshold) * niRate : 0;
    const net = salaryAfterPension - incomeTax - ni;

    return {
      pension,
      incomeTax,
      nationalInsurance: ni,
      netAnnual: net,
      netMonthly: net / 12,
      bandInfo: getTaxBand(salaryAfterPension),
    };
  };

  const adjustedSalary = grossSalary * workHoursFactor;
  const result = calculateNetSalary(Number(adjustedSalary), Number(pensionContribution));

  useEffect(() => {
    localStorage.setItem("netMonthlySalary", result.netMonthly.toString());
  }, [result.netMonthly]);

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
              <div
                className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${result.bandInfo.color}`}
              >
                {result.bandInfo.label}
              </div>
              <CardTitle className="text-xl">UK Net Salary Estimator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="salary">Gross Annual Salary (£)</Label>
                  <Input
                    type="number"
                    id="salary"
                    value={grossSalary}
                    onChange={(e) => setGrossSalary(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="pension">Pension Contribution (%)</Label>
                  <Input
                    type="number"
                    id="pension"
                    value={pensionContribution}
                    onChange={(e) => setPensionContribution(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="workHours">Work Hours Factor (0 to 1)</Label>
                  <Input
                    type="number"
                    id="workHours"
                    min={0}
                    max={1}
                    step={0.01}
                    value={workHoursFactor}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (val < 0) val = 0;
                      if (val > 1) val = 1;
                      setWorkHoursFactor(val);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-4 rounded-xl shadow">
                  <h3 className="font-semibold mb-2">Annual Summary</h3>
                  <p><strong>Pension Contribution:</strong> £{result.pension.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Income Tax:</strong> £{result.incomeTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>National Insurance:</strong> £{result.nationalInsurance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Net Annual Salary:</strong> £{result.netAnnual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl shadow">
                  <h3 className="font-semibold mb-2">Monthly Summary</h3>
                  <p><strong>Pension Contribution:</strong> £{(result.pension / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Income Tax:</strong> £{(result.incomeTax / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>National Insurance:</strong> £{(result.nationalInsurance / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p><strong>Net Monthly Salary:</strong> £{result.netMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
