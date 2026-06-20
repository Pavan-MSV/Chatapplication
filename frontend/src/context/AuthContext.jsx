import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth, isConfigured as isFirebaseConfigured } from "../config/firebase";

import { API_BASE } from "../config/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync session on load
  useEffect(() => {
    const checkUserSession = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await axios.get(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        } catch (err) {
          console.error("Token expired or invalid:", err);
          localStorage.removeItem("token");
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkUserSession();
  }, []);

  const handleAuthSuccess = (tokenData) => {
    localStorage.setItem("token", tokenData.access_token);
    setUser({
      id: tokenData.user_id,
      username: tokenData.username,
      email: tokenData.email,
      profile_photo: tokenData.profile_photo
    });
  };

  const loginWithEmail = async (email, password) => {
    setLoading(true);
    try {
      // Use Direct Backend API Login to support custom email OTP verification status
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      handleAuthSuccess(res.data);
      return { success: true };
    } catch (err) {
      console.error("Login failed:", err);
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (status === 403 || (detail && detail.includes("verified"))) {
        throw { requires_verification: true, email: email, message: detail };
      }
      throw new Error(detail || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (username, email, password) => {
    setLoading(true);
    try {
      // Use Direct Backend API Register to generate and send custom OTP codes
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username,
        email,
        password
      });
      if (res.data.access_token) {
        handleAuthSuccess(res.data);
        return { success: true };
      } else {
        return { requires_verification: true, email: email, message: res.data.message };
      }
    } catch (err) {
      console.error("Registration failed:", err);
      throw new Error(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      // Mock Google sign-in in dev mode if Firebase not set
      setLoading(true);
      try {
        const mockRes = await axios.post(`${API_BASE}/auth/verify`, {
          firebase_id_token: "mock:google_uid:google_user@example.com:Google_User"
        });
        handleAuthSuccess(mockRes.data);
        return true;
      } catch (err) {
        console.error("Mock Google login failed:", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credentials = await signInWithPopup(firebaseAuth, provider);
      const firebaseToken = await credentials.user.getIdToken();
      
      const res = await axios.post(`${API_BASE}/auth/verify`, {
        firebase_id_token: firebaseToken
      });
      handleAuthSuccess(res.data);
      return true;
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      throw new Error(err.response?.data?.detail || "Google Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otpCode) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/verify-otp`, {
        email,
        otp_code: otpCode
      });
      handleAuthSuccess(res.data);
      return true;
    } catch (err) {
      console.error("OTP verification failed:", err);
      throw new Error(err.response?.data?.detail || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (email) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/resend-otp`, { email });
      return res.data.message || "Verification OTP code resent.";
    } catch (err) {
      console.error("OTP resend failed:", err);
      throw new Error(err.response?.data?.detail || "Failed to resend verification code.");
    }
  };

  const logout = async () => {
    try {
      if (isFirebaseConfigured && firebaseAuth) {
        await signOut(firebaseAuth);
      }
    } catch (err) {
      console.error("Firebase logout warning:", err);
    }
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        verifyOtp,
        resendOtp,
        logout,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
