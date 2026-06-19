import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, MessageSquare, AlertCircle, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { loginWithEmail, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await loginWithEmail(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await loginWithGoogle();
      navigate("/");
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 px-4 relative overflow-hidden">
      {/* Decorative backdrop blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-screen filter blur-[128px] opacity-20"></div>

      <div className="w-full max-w-md glass border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-brand-500 to-indigo-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold font-display text-white tracking-tight">ChatSphere AI</h2>
          <p className="text-slate-400 text-sm mt-1">Enterprise Real-Time Workspace</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-200 p-4 rounded-xl text-sm mb-6 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-slate-900/60 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-900/60 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium py-3 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <span className="relative bg-slate-950/20 px-3 text-xs text-slate-500 font-semibold uppercase tracking-wider z-10">Or continue with</span>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 py-3 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 15.02 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.84 2.98C6.01 7.22 8.78 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.45h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.74-4.87 3.74-8.51z"
            />
            <path
              fill="#FBBC05"
              d="M5.08 14.88c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.24 7.28C.45 8.9.01 10.73.01 12.64s.44 3.74 1.23 5.36l3.84-3.12z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.8 1.09-3.22 0-5.99-2.18-6.96-5.11l-3.84 3.12C3.2 20.27 7.24 23 12 23z"
            />
          </svg>
          <span className="text-sm font-medium">Sign in with Google</span>
        </button>

        <p className="text-center text-slate-400 text-sm mt-8">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-400 hover:text-brand-350 font-medium inline-flex items-center gap-1 hover:underline">
            <span>Register here</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </p>
      </div>
    </div>
  );
}
