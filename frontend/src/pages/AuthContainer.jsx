import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, UserPlus, MessageSquare, AlertCircle, Sparkles } from "lucide-react";

export default function AuthContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loading } = useAuth();

  // Determine mode from the URL path
  const isSignUpPath = location.pathname === "/register";
  const [isSignUp, setIsSignUp] = useState(isSignUpPath);
  const [error, setError] = useState("");

  // Login Form States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form States
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // Keep state in sync if path changes externally
  useEffect(() => {
    setIsSignUp(isSignUpPath);
    setError("");
  }, [isSignUpPath]);

  const toggleMode = (targetSignUp) => {
    setError("");
    setIsSignUp(targetSignUp);
    if (targetSignUp) {
      navigate("/register", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await loginWithEmail(loginEmail, loginPassword);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (registerUsername.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (registerPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    try {
      await registerWithEmail(registerUsername, registerEmail, registerPassword);
      navigate("/");
    } catch (err) {
      setError(err.message || "Registration failed.");
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 relative overflow-hidden">
      {/* Dynamic Background Blobs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15 animate-pulse duration-10000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15"></div>

      {/* Main Sliding Wrapper */}
      <div className={`auth-wrapper glass ${isSignUp ? "active" : ""}`}>
        
        {/* ========================================================================= */}
        {/* SIGN UP FORM CONTAINER (slides to right when active, z-index 5) */}
        {/* ========================================================================= */}
        <div className="auth-form-container auth-sign-up w-full md:w-1/2 h-full flex flex-col justify-center px-8 md:px-12 py-10 z-1">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-500 to-emerald-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
              <UserPlus className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Create Account</h2>
            <p className="text-slate-400 text-xs mt-1">Join ChatSphere AI workspace</p>
          </div>

          {error && isSignUp && (
            <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-200 p-3.5 rounded-xl text-xs mb-4 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
              <input
                type="text"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="pavan"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="you@example.com"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="at least 6 characters"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative bg-slate-900/60 px-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider z-10">Or continue with</span>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-slate-950/40 hover:bg-slate-900/60 border border-slate-800 text-slate-200 py-2.5 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span className="text-xs font-semibold">Sign up with Google</span>
          </button>

          {/* Mobile switcher link */}
          <p className="text-center text-slate-400 text-xs mt-5 md:hidden">
            Already have an account?{" "}
            <button
              onClick={() => toggleMode(false)}
              className="text-brand-400 hover:underline font-semibold ml-1 cursor-pointer bg-transparent border-none"
            >
              Sign In here
            </button>
          </p>
        </div>

        {/* ========================================================================= */}
        {/* SIGN IN FORM CONTAINER (on left when inactive, active pushes to right) */}
        {/* ========================================================================= */}
        <div className="auth-form-container auth-sign-in w-full md:w-1/2 h-full flex flex-col justify-center px-8 md:px-12 py-10 z-2">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-500 to-emerald-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">ChatSphere AI</h2>
            <p className="text-slate-400 text-xs mt-1">Enterprise Real-Time Workspace</p>
          </div>

          {error && !isSignUp && (
            <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-200 p-3.5 rounded-xl text-xs mb-4 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <span className="relative bg-slate-900/60 px-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider z-10">Or continue with</span>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-slate-950/40 hover:bg-slate-900/60 border border-slate-800 text-slate-200 py-2.5 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span className="text-xs font-semibold">Sign in with Google</span>
          </button>

          {/* Mobile switcher link */}
          <p className="text-center text-slate-400 text-xs mt-5 md:hidden">
            Don't have an account?{" "}
            <button
              onClick={() => toggleMode(true)}
              className="text-brand-400 hover:underline font-semibold ml-1 cursor-pointer bg-transparent border-none"
            >
              Register here
            </button>
          </p>
        </div>

        {/* ========================================================================= */}
        {/* SLIDING TOGGLE COVER (hidden on mobile) */}
        {/* ========================================================================= */}
        <div className="auth-toggle-container">
          <div className="auth-toggle">
            
            {/* Sliding Panel: Left Side (Register Mode Prompts) */}
            <div className="auth-toggle-panel auth-toggle-left font-sans">
              <div className="flex justify-center mb-4">
                <Sparkles className="w-10 h-10 text-emerald-300 animate-bounce" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3">Already a Member?</h2>
              <p className="text-emerald-100 text-sm leading-relaxed mb-8 max-w-[280px]">
                Sign in with your account details to access your workspace and keep chatting.
              </p>
              <button
                onClick={() => toggleMode(false)}
                className="bg-transparent hover:bg-white/10 text-white font-bold border border-white hover:border-white px-10 py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            </div>

            {/* Sliding Panel: Right Side (Login Mode Prompts) */}
            <div className="auth-toggle-panel auth-toggle-right font-sans">
              <div className="flex justify-center mb-4">
                <Sparkles className="w-10 h-10 text-emerald-300 animate-bounce" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3">New to ChatSphere?</h2>
              <p className="text-emerald-100 text-sm leading-relaxed mb-8 max-w-[280px]">
                Create an account to start real-time messaging and collaborative group chats.
              </p>
              <button
                onClick={() => toggleMode(true)}
                className="bg-transparent hover:bg-white/10 text-white font-bold border border-white hover:border-white px-10 py-2.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              >
                Sign Up
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
