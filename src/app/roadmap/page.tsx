'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

type FinancialPriority = {
  id: number;
  title: string;
  description: string | null;
  category: string | null; // Matches "category" in DB
  order_position: number;  // Matches "order_position" in DB
};

export default function RoadmapPage() {
  const [priorities, setPriorities] = useState<FinancialPriority[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPriorities = async () => {
      const { data, error } = await supabase
        .from('financial_priorities')
        .select('id, title, description, category, order_position')
        .order('order_position', { ascending: true });

      if (error) {
        console.error('Error fetching priorities:', error);
      } else {
        setPriorities(data || []);
      }

      setLoading(false);
    };

    fetchPriorities();
  }, []);

  return (
    <>
      <Navbar />
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Financial Roadmap</h1>

        {loading ? (
          <p>Loading roadmap...</p>
        ) : priorities.length === 0 ? (
          <p>No roadmap priorities found.</p>
        ) : (
          <div className="space-y-4">
            {priorities.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>
                        {index + 1}. {p.title}
                      </span>
                      <span className="text-xs uppercase text-gray-500">
                        {p.category || 'Uncategorized'}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">
                      {p.description || 'No description available.'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
