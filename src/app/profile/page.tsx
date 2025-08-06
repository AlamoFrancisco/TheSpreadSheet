"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar"; // ✅ Navbar added

export default function UserProfileForm() {
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    salary: "",
    photo: null as File | null,
  });

  useEffect(() => {
    const saved = localStorage.getItem("userProfile");
    if (saved) {
      const parsed = JSON.parse(saved);
      setProfile({
        ...parsed,
        photo: null, // reset photo input
      });
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    const { name } = target;

    if (target instanceof HTMLInputElement && target.type === "file") {
      setProfile((prev) => ({
        ...prev,
        [name]: target.files && target.files[0] ? target.files[0] : null,
      }));
    } else {
      setProfile((prev) => ({
        ...prev,
        [name]: target.value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { photo, ...profileWithoutPhoto } = profile;

    // Convert salary to number before saving
    const formatted = {
      ...profileWithoutPhoto,
      salary: Number(profileWithoutPhoto.salary),
    };

    localStorage.setItem("userProfile", JSON.stringify(formatted));
    alert("Profile saved locally!");
  };

  const getMaxDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 18);
    return today.toISOString().split("T")[0];
  };

  return (
    <>
      <Navbar /> {/* ✅ Top navigation bar */}
      <div className="min-h-screen p-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-xl"
        >
          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">User Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col items-center">
                  {profile.photo ? (
                    <img
                      src={URL.createObjectURL(profile.photo)}
                      alt="Profile Preview"
                      className="rounded-full w-32 h-32 object-cover border-2 border-gray-300 mb-2"
                    />
                  ) : (
                    <div className="rounded-full w-32 h-32 bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center mb-2 text-sm text-gray-500">
                      Drag an image here
                    </div>
                  )}
                  <Input
                    type="file"
                    name="photo"
                    onChange={handleChange}
                    accept="image/*"
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      name="firstName"
                      value={profile.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      name="lastName"
                      value={profile.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    name="gender"
                    value={profile.gender}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
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
                    max={getMaxDate()}
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
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Save Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
