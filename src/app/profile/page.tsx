'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';

type Profile = {
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  dob: string;
  salary: string;
  photo: File | null;
  photo_url?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({
    first_name: '',
    last_name: '',
    email: '',
    gender: '',
    dob: '',
    salary: '',
    photo: null,
    photo_url: '',
  });

  const [editable, setEditable] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !session?.user) {
        setLoading(false);
        router.replace('/login');
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('first_name,last_name,email,gender,dob,salary,photo_url')
        .eq('id', uid)
        .single();

      // If RLS blocks or request fails, surface it
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Fetch profile error:', profileError);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          email: data.email ?? '',
          gender: data.gender ?? '',
          dob: data.dob ?? '',
          salary: (data.salary ?? '').toString(),
          photo: null,
          photo_url: data.photo_url ?? '',
        });
        setEditable(false);
      } else {
        setEditable(true); // new user
      }

      setLoading(false);
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (e.target.type === 'file' && files) {
      setProfile((prev) => ({ ...prev, photo: files[0] }));
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  const uploadPhoto = async (): Promise<string | undefined> => {
    if (!profile.photo || !userId) return profile.photo_url;

    const fileExt = profile.photo.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, profile.photo, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return undefined;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data?.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const photoUrl = await uploadPhoto();

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      gender: profile.gender,
      dob: profile.dob,
      salary: Number(profile.salary),
      photo_url: photoUrl || null,
      last_login: new Date().toISOString(),
    });

    if (error) {
      console.error('Save error:', error);
      alert('Failed to save profile');
    } else {
      alert('Profile saved!');
      router.push('/');
    }
  };

  return (
    <>
      {!editable && <Navbar />}
      <div className="min-h-screen p-6 flex flex-col items-center">
        {loading ? (
          <p>Loading profile...</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-xl"
          >
            <Card className="shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl flex justify-between">
                  User Profile
                  {!editable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditable(true)}
                    >
                      Edit
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col items-center">
                    {profile.photo ? (
                      <img
                        src={URL.createObjectURL(profile.photo)}
                        alt="Preview"
                        className="rounded-full w-32 h-32 object-cover border mb-2"
                      />
                    ) : profile.photo_url ? (
                      <img
                        src={profile.photo_url}
                        alt="Profile"
                        className="rounded-full w-32 h-32 object-cover border mb-2"
                      />
                    ) : (
                      <div className="rounded-full w-32 h-32 bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center mb-2 text-sm text-gray-500">
                        No image
                      </div>
                    )}
                    <Input
                      type="file"
                      name="photo"
                      accept="image/*"
                      onChange={handleChange}
                      className="w-full"
                      disabled={!editable}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        name="first_name"
                        value={profile.first_name}
                        onChange={handleChange}
                        disabled={!editable}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        name="last_name"
                        value={profile.last_name}
                        onChange={handleChange}
                        disabled={!editable}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      name="email"
                      type="email"
                      value={profile.email}
                      onChange={handleChange}
                      disabled={!editable}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      name="gender"
                      value={profile.gender}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      disabled={!editable}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      type="date"
                      name="dob"
                      value={profile.dob}
                      onChange={handleChange}
                      disabled={!editable}
                      max={new Date(
                        new Date().setFullYear(new Date().getFullYear() - 18)
                      )
                        .toISOString()
                        .split('T')[0]}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="salary">Current Salary (£/year)</Label>
                    <Input
                      type="number"
                      name="salary"
                      value={profile.salary}
                      onChange={handleChange}
                      disabled={!editable}
                      required
                    />
                  </div>

                  {editable && (
                    <Button type="submit" className="w-full">
                      Save Profile
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </>
  );
}
