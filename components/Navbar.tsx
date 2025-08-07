'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUser } from 'react-icons/fa';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@supabase/supabase-js';

const supabase = createClientComponentClient();

export default function Navbar() {
  const router = useRouter();
  const [selectedApp, setSelectedApp] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setCheckingSession(false);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleAppChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedApp(value);
    if (value) router.push(value);
  };

  const goHome = () => router.push('/');
  const goProfile = () => router.push('/profile');

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="w-full px-4 py-3 shadow-md bg-white flex justify-between items-center sticky top-0 z-50">
      {/* Left side: Logo + App Dropdown */}
      <div className="flex items-center gap-4">
        <button
          onClick={goHome}
          className="text-xl font-bold text-blue-600 hover:underline"
        >
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

      {/* Right side: Profile + Login/Logout */}
      <div className="flex items-center gap-4">
        {!checkingSession && session && (
          <button
            onClick={goProfile}
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <FaUser /> Profile
          </button>
        )}

        {!checkingSession && session ? (
          <button
            onClick={logout}
            className="text-red-600 hover:underline text-sm"
          >
            Logout
          </button>
        ) : !checkingSession ? (
          <Link
            href="/login"
            className="text-blue-600 hover:underline text-sm"
          >
            Login
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
