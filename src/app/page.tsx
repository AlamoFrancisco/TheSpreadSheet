"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [app, setApp] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setApp(value);
    if (value) {
      router.push(value);
    }
  };

  return (
    <main className="p-10 space-y-4">
      <h1 className="text-3xl font-bold">Welcome to The Spreadsheet</h1>

      <label htmlFor="app-select" className="block mb-2 font-medium">
        Choose an app to open:
      </label>
      <select
        id="app-select"
        value={app}
        onChange={handleChange}
        className="border p-2 rounded"
      >
        <option value="">-- Select an app --</option>
        <option value="/budget">Budget App</option>
        <option value="/mortgage">Mortgage Calculator</option>
        <option value="/retirement">Retirement Planner</option>
        <option value="/salary">Net Salary Estimator</option>
      </select>
    </main>
  );
}
