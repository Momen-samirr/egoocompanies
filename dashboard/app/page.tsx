"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const maybeErr = err as {
        code?: string;
        message?: string;
        response?: { data?: { message?: string } };
      };
      console.error("Login error:", err);
      if (
        maybeErr.code === "ERR_NETWORK" ||
        maybeErr.message?.includes("Network Error")
      ) {
        setError("Cannot connect to server. Please make sure the backend server is running on port 8000.");
      } else {
        setError(
          maybeErr.response?.data?.message ||
            maybeErr.message ||
            "Login failed"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb] text-[#191c1e]">
      <main className="grow flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-100 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md z-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 primary-gradient rounded-xl flex items-center justify-center mb-4 shadow-xl">
              <span className="text-white text-2xl font-black">KP</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Kinetic Precision</h1>
            <p className="text-[#464554] font-medium text-sm">Logistics Control Systems</p>
          </div>

          <div className="bg-white rounded-xl p-10 shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
            <div className="mb-8">
              <h2 className="text-xl font-bold tracking-tight mb-2">Welcome Back</h2>
              <p className="text-[#464554] text-sm">
                Access your dispatch dashboard to manage fleet operations.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-bold tracking-wider uppercase text-[#464554]">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full h-12 px-4 bg-[#e0e3e5] text-[#191c1e] rounded-lg transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-[#767586]"
                  placeholder="name@kinetic-precision.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label htmlFor="password" className="block text-xs font-bold tracking-wider uppercase text-[#464554]">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full h-12 px-4 bg-[#e0e3e5] text-[#191c1e] rounded-lg transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-[#767586]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 select-none">
                <input className="w-4 h-4 rounded border-[#c7c4d7] text-primary focus:ring-primary/20" type="checkbox" />
                <span className="text-sm text-[#464554] font-medium">Remember this device</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 primary-gradient text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
