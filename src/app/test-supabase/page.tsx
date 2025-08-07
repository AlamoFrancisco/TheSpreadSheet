'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SupabaseTestPage() {
  const [message, setMessage] = useState('Connecting...');
  const supabase = createClientComponentClient();

  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase.from('profiles').select('*').limit(1);
      if (error) {
        setMessage(`❌ Supabase Error: ${error.message}`);
      } else {
        setMessage(`✅ Connected! Retrieved ${data.length} row(s) from "profiles"`);
      }
    };

    testConnection();
  }, [supabase]);

  const insertTestRow = async () => {
    const { error } = await supabase.from('profiles').insert([
      {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      },
    ]);

    if (error) {
      alert(`❌ Failed to insert: ${error.message}`);
    } else {
      alert('✅ Row inserted successfully!');
    }
  };

  return (
    <div className="p-10 text-lg font-medium text-center">
      <p className="mb-4">{message}</p>
      <button
        onClick={insertTestRow}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Insert Test Profile
      </button>
    </div>
  );
}
