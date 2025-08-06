// components/Navbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { FaUser, FaHome } from "react-icons/fa";
import { useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [selectedApp, setSelectedApp] = useState("");

  const goHome = () => router.push("/");
  const goProfile = () => router.push("/profile");

  const handleAppChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedApp(value);
    if (value) router.push(value);
  };

  return (
    <nav className="w-full px-4 py-3 shadow-md bg-white flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <button onClick={goHome} className="text-xl font-bold text-blue-600 hover:underline">
          🧮 The Spreadsheet
        </button>

        <select
          value={selectedApp}
          onChange={handleAppChange}
          className="border p-2 rounded"
        >
          <option value="">Apps</option>
          <option value="/budget">Budget App</option>
          <option value="/mortgage">Mortgage Calculator</option>
          <option value="/retirement">Retirement Planner</option>
          <option value="/salary">Net Salary Estimator</option>
          <option value="/goals">Savings & Debt Goals</option>
        </select>
      </div>

      <button
        onClick={goProfile}
        className="flex items-center gap-2 text-blue-600 hover:underline"
      >
        <FaUser /> Profile
      </button>
    </nav>
  );
}
