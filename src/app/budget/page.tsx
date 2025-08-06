"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

type TabKey = "essentials" | "priorities" | "lifestyle";

interface Category {
  id: number;
  name: string;
  value: number;
  type: TabKey;
}

const initialCategories: Category[] = [
  { id: 1, name: "Rent", value: 700, type: "essentials" },
  { id: 2, name: "Groceries", value: 275, type: "essentials" },
  { id: 3, name: "Transport", value: 60, type: "essentials" },
  { id: 4, name: "Savings", value: 50, type: "priorities" },
  { id: 5, name: "Debt Repayment", value: 200, type: "priorities" },
  { id: 6, name: "Entertainment", value: 125, type: "lifestyle" },
  { id: 7, name: "Dining Out", value: 80, type: "lifestyle" },
];

const TAB_LABELS: Record<TabKey, string> = {
  essentials: "Essentials",
  priorities: "Priorities",
  lifestyle: "Lifestyle",
};

const allocationPct = (tab: TabKey) => {
  switch (tab) {
    case "essentials":
      return 0.5;
    case "priorities":
      return 0.2;
    case "lifestyle":
      return 0.3;
    default:
      return 0;
  }
};

export default function BudgetApp() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [manualSalary, setManualSalary] = useState<number>(0);
  const [salary, setSalary] = useState<number>(0); // this will hold the monthly salary used for budget
  const [currentTab, setCurrentTab] = useState<TabKey>("essentials");
  const [nextId, setNextId] = useState<number>(initialCategories.length + 1);

  const [open, setOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatValue, setNewCatValue] = useState<string>("");

  const [valueInputs, setValueInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    // Load net monthly salary from localStorage if available
    const netMonthly = localStorage.getItem("netMonthlySalary");
    if (netMonthly) {
      const netMonthlyNum = Number(netMonthly);
      if (!isNaN(netMonthlyNum) && netMonthlyNum > 0) {
        setSalary(netMonthlyNum);
        setManualSalary(netMonthlyNum);
        return;
      }
    }
    // Fallback: load manual salary from profile if exists
    const savedProfile = localStorage.getItem("userProfile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        if (profile.salary) {
          const annualSalary = Number(profile.salary);
          if (!isNaN(annualSalary) && annualSalary > 0) {
            const monthlySalary = annualSalary / 12;
            setSalary(monthlySalary);
            setManualSalary(monthlySalary);
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }, []);

  // If manual salary input changes, update salary (override netMonthly)
  useEffect(() => {
    setSalary(manualSalary);
  }, [manualSalary]);

  const totalAll = categories.reduce((sum, c) => sum + c.value, 0);
  const remaining = salary - totalAll;

  const tabCats = (tab: TabKey) => categories.filter((c) => c.type === tab);
  const tabTotal = (tab: TabKey) => tabCats(tab).reduce((s, c) => s + c.value, 0);
  const tabBudget = (tab: TabKey) => salary * allocationPct(tab);

  const saveNewCategory = () => {
    const value = Number(newCatValue);
    if (!newCatName.trim() || !Number.isFinite(value) || value < 0) {
      alert("Please enter a valid name and value (>=0)");
      return;
    }

    setCategories((prev) => [
      ...prev,
      {
        id: nextId,
        name: newCatName.trim(),
        value,
        type: currentTab,
      },
    ]);
    setNextId((id) => id + 1);
    setNewCatName("");
    setNewCatValue("");
    setOpen(false);
  };

  const deleteCategory = (catId: number) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const updateValue = (cat: Category) => {
    const amount = Number(valueInputs[cat.id]);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Enter a valid non-negative amount");
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, value: amount } : c))
    );
    setValueInputs((prev) => ({ ...prev, [cat.id]: "" }));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 gap-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-bold"
      >
        My Budget
      </motion.h1>

      {/* Salary + 50/30/20 overview */}
      <Card className="w-full max-w-3xl shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Monthly Salary & 50/30/20</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            value={manualSalary}
            onChange={(e) =>
              setManualSalary(e.target.value === "" ? 0 : Number(e.target.value))
            }
            placeholder="Enter your monthly salary"
          />
          <div className="grid grid-cols-3 gap-3 text-sm">
            {(["essentials", "lifestyle", "priorities"] as TabKey[]).map(
              (tab) => (
                <div key={tab} className="bg-white rounded-xl p-3 shadow">
                  <div className="font-medium">{TAB_LABELS[tab]}</div>
                  <div>
                    Budget: £{(tabBudget(tab) || 0).toFixed(2)} (
                    {(allocationPct(tab) * 100).toFixed(0)}%)
                  </div>
                  <div>Current: £{tabTotal(tab).toFixed(2)}</div>
                  <div>
                    Left: £
                    {Math.max(0, (tabBudget(tab) - tabTotal(tab)) || 0).toFixed(2)}
                  </div>
                  <Progress
                    value={
                      tabBudget(tab)
                        ? Math.min(100, (tabTotal(tab) / tabBudget(tab)) * 100)
                        : 0
                    }
                  />
                </div>
              )
            )}
          </div>
          <div className="text-sm text-gray-600">
            Overall remaining vs salary: £
            {Number.isFinite(remaining) ? remaining.toFixed(2) : "0.00"}
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={currentTab}
        onValueChange={(v) => setCurrentTab(v as TabKey)}
        className="w-full max-w-3xl"
      >
        <TabsList className="grid grid-cols-3 mb-4 bg-white shadow rounded-2xl">
          <TabsTrigger value="essentials">Essentials (50%)</TabsTrigger>
          <TabsTrigger value="priorities">Priorities (20%)</TabsTrigger>
          <TabsTrigger value="lifestyle">Lifestyle (30%)</TabsTrigger>
        </TabsList>

        {(["essentials", "priorities", "lifestyle"] as TabKey[]).map((tab) => {
          const cats = tabCats(tab);
          const total = tabTotal(tab);
          const budget = tabBudget(tab);
          const left = (budget || 0) - total;

          return (
            <TabsContent key={tab} value={tab} className="space-y-6">
              {/* Tab overview */}
              <Card className="shadow-xl rounded-2xl">
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-xl capitalize">{TAB_LABELS[tab]} Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    Budget: £{(budget || 0).toFixed(2)} (
                    {(allocationPct(tab) * 100).toFixed(0)}%)
                  </div>
                  <div>Total: £{total.toFixed(2)}</div>
                  <div className="col-span-2">
                    <Progress
                      value={budget ? Math.min(100, (total / budget) * 100) : 0}
                    />
                    <div className="mt-1">Left: £{Math.max(0, left).toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Category cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cats.map((cat) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="shadow-lg rounded-2xl">
                      <CardHeader>
                        <CardTitle>{cat.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Value</span>
                          <span>£{cat.value}</span>
                        </div>
                        <div className="flex gap-2 items-center mt-2">
                          <Input
                            type="number"
                            placeholder="New value"
                            className="flex-1"
                            value={valueInputs[cat.id] ?? ""}
                            onChange={(e) =>
                              setValueInputs((prev) => ({
                                ...prev,
                                [cat.id]: e.target.value,
                              }))
                            }
                          />
                          <Button size="sm" onClick={() => updateValue(cat)}>
                            Update
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          Delete Category
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Add new category */}
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
                      <Input
                        placeholder="Category name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Value"
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
  );
}
