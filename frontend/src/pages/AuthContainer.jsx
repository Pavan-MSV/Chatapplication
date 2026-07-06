import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, UserPlus, MessageSquare, AlertCircle, Sparkles, ArrowLeft, Phone } from "lucide-react";
import { RecaptchaVerifier } from "firebase/auth";
import { auth as firebaseAuth } from "../config/firebase";

export default function AuthContainer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithPhone, confirmPhoneCode, verifyOtp, resendOtp, loading } = useAuth();

  // Determine mode from the URL path
  const isSignUpPath = location.pathname === "/register";
  const [isSignUp, setIsSignUp] = useState(isSignUpPath);
  const [error, setError] = useState("");

  // OTP Verification States
  const [showOtp, setShowOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  // Login Form States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form States
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // Phone OTP States
  const [registerPhone, setRegisterPhone] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [phoneLoginMode, setPhoneLoginMode] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [showSmsVerification, setShowSmsVerification] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

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
      // AuthContext updates user state -> PublicRoute automatically redirects to "/"
    } catch (err) {
      if (err.requires_verification) {
        setOtpEmail(err.email);
        setOtpMessage("Please verify your email to complete login. Verification code sent.");
        setOtpError("");
        setShowOtp(true);
      } else {
        setError(err.message || "Invalid email or password.");
      }
    }
  };

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }
    const container = document.getElementById("recaptcha-container");
    if (!container) {
      console.error("recaptcha-container element not found in DOM");
      return null;
    }
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
        size: "invisible",
        callback: (response) => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          setError("reCAPTCHA expired. Please request SMS code again.");
        }
      });
      return window.recaptchaVerifier;
    } catch (err) {
      console.error("Error initializing RecaptchaVerifier:", err);
      return null;
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
    if (!registerPhone || registerPhone.trim() === "") {
      setError("Phone number is required.");
      return;
    }

    setSmsLoading(true);
    try {
      let appVerifier = null;
      if (firebaseAuth) {
        appVerifier = setupRecaptcha();
      }
      const result = await loginWithPhone(registerPhone.trim(), appVerifier);
      setConfirmationResult(result);
      setPhoneLoginMode(false);
      setShowSmsVerification(true);
    } catch (err) {
      setError(err.message || "Failed to send SMS verification code. Please check your phone format (e.g. +1234567890).");
    } finally {
      setSmsLoading(false);
    }
  };

  const handlePhoneLoginInitiate = async (e) => {
    e.preventDefault();
    setError("");
    if (!loginPhone || loginPhone.trim() === "") {
      setError("Phone number is required.");
      return;
    }

    setSmsLoading(true);
    try {
      let appVerifier = null;
      if (firebaseAuth) {
        appVerifier = setupRecaptcha();
      }
      const result = await loginWithPhone(loginPhone.trim(), appVerifier);
      setConfirmationResult(result);
      setPhoneLoginMode(true);
      setShowSmsVerification(true);
    } catch (err) {
      setError(err.message || "Failed to send verification SMS.");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsVerifySubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSmsLoading(true);
    try {
      if (phoneLoginMode) {
        await confirmPhoneCode(confirmationResult, smsCode);
      } else {
        const result = await confirmationResult.confirm(smsCode);
        const firebaseUid = result.user.uid;
        await registerWithEmail(
          registerUsername,
          registerEmail,
          registerPassword,
          registerPhone.trim(),
          firebaseUid
        );
      }
    } catch (err) {
      console.error("SMS verification failed:", err);
      setError(err.message || "Invalid or expired SMS verification code.");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpLoading(true);
    try {
      await verifyOtp(otpEmail, otpCode);
    } catch (err) {
      setOtpError(err.message || "OTP verification failed.");
    } finally {
      setOtpLoading(false);
    }
  };



  const handleResendOtp = async () => {
    setOtpError("");
    setOtpMessage("");
    try {
      const msg = await resendOtp(otpEmail);
      setOtpMessage(msg || "OTP code resent successfully.");
    } catch (err) {
      setOtpError(err.message || "Failed to resend verification code.");
    }
  };

  if (showSmsVerification) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 relative overflow-hidden">
        {/* Dynamic Background Blobs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15 animate-pulse duration-10000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15"></div>

        {/* SMS OTP Verification Card */}
        <div className="w-full max-w-md p-8 glass rounded-2xl flex flex-col justify-center z-10 text-white shadow-2xl border border-white/10">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-500 to-emerald-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{phoneLoginMode ? "Phone Login Verification" : "Verify Phone Number"}</h2>
            <p className="text-slate-400 text-xs mt-1 text-center leading-relaxed">
              We've sent a 6-digit SMS verification code to <br/>
              <span className="text-brand-300 font-semibold text-sm">{phoneLoginMode ? loginPhone : registerPhone}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-200 p-3.5 rounded-xl text-xs mb-4 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSmsVerifySubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">SMS Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="000000"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button
              type="submit"
              disabled={smsLoading || smsCode.length !== 6}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {smsLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span>{phoneLoginMode ? "Verify & Login" : "Confirm & Sign Up"}</span>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3.5 items-center text-xs">
            <button
              onClick={() => {
                setShowSmsVerification(false);
                setSmsCode("");
                setError("");
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1.5 hover:underline bg-transparent border-none cursor-pointer mt-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Back to details</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showOtp) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 relative overflow-hidden">
        {/* Dynamic Background Blobs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15 animate-pulse duration-10000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-screen filter blur-[128px] opacity-15"></div>

        {/* OTP Verification Card */}
        <div className="w-full max-w-md p-8 glass rounded-2xl flex flex-col justify-center z-10 text-white shadow-2xl border border-white/10">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-500 to-emerald-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Verify Your Email</h2>
            <p className="text-slate-400 text-xs mt-1 text-center leading-relaxed">
              We've sent a 6-digit OTP code to <br/>
              <span className="text-brand-300 font-semibold text-sm">{otpEmail}</span>
            </p>
          </div>

          {otpMessage && (
            <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-800/65 text-emerald-200 p-3.5 rounded-xl text-xs mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{otpMessage}</span>
            </div>
          )}

          {otpError && (
            <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/60 text-red-200 p-3.5 rounded-xl text-xs mb-4">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Verification Code (OTP)</label>
              <input
                type="text"
                required
                maxLength={6}
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button
              type="submit"
              disabled={otpLoading || otpCode.length !== 6}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {otpLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span>Verify & Login</span>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3.5 items-center text-xs">
            <button
              onClick={handleResendOtp}
              className="text-brand-400 hover:text-brand-300 font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              Resend verification code
            </button>
            <button
              onClick={() => {
                setShowOtp(false);
                setOtpCode("");
                setOtpError("");
                setOtpMessage("");
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1.5 hover:underline bg-transparent border-none cursor-pointer mt-1"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Back to sign in / sign up</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
              <input
                type="tel"
                required
                className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                placeholder="+15555555555"
                value={registerPhone}
                onChange={(e) => setRegisterPhone(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || smsLoading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {loading || smsLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register & Verify Phone</span>
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

          <form onSubmit={phoneLoginMode ? handlePhoneLoginInitiate : handleLoginSubmit} className="space-y-4">
            {!phoneLoginMode ? (
              <>
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
              </>
            ) : (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  required
                  className="w-full bg-slate-950/40 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all focus:ring-1 focus:ring-brand-500/30"
                  placeholder="+15555555555"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || smsLoading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
            >
              {loading || smsLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  {phoneLoginMode ? <Phone className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  <span>{phoneLoginMode ? "Send Verification SMS" : "Log In"}</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-3">
            <button
              onClick={() => {
                setError("");
                setPhoneLoginMode(!phoneLoginMode);
              }}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              {phoneLoginMode ? "Login with Email / Username instead" : "Login with Phone number instead"}
            </button>
          </div>

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
      <div id="recaptcha-container"></div>
    </div>
  );
}
