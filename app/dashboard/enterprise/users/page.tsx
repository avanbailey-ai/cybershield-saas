"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: { email: string; full_name: string | null } | null;
}

export default function EnterpriseUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/org/members");
      const data = await res.json();
      if (res.ok) setMembers(data.members ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/org/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Invite failed");
      return;
    }
    setMessage(data.message ?? "Invite sent");
    setEmail("");
    void loadMembers();
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    const res = await fetch(`/api/org/members/${memberId}`, { method: "DELETE" });
    if (res.ok) void loadMembers();
    else {
      const data = await res.json();
      setError(data.error ?? "Remove failed");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DashboardHeader email="Team Management" />

      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/dashboard/enterprise" className="text-sm text-gray-500 hover:text-gray-300">
            ← Enterprise
          </Link>
        </div>

        <h2 className="mb-6 text-xl font-bold text-white">Team Members</h2>

        <form onSubmit={handleInvite} className="mb-8 flex flex-wrap gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <input
            type="email"
            required
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Invite
          </button>
        </form>

        {message && <p className="mb-4 text-sm text-green-400">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500">No team members found.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}
                  </p>
                  <p className="text-xs text-gray-500">{m.profiles?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs capitalize text-gray-400">
                    {m.role}
                  </span>
                  {m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
