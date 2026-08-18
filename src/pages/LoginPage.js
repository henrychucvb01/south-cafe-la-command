import React, { useState } from "react";
import { supabase } from "../supabaseClient";

function LoginPage({ onLocationSelected, onSupervisor }) {
  const [locationCode, setLocationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .select("*")
        .eq("location_code", locationCode)
        .eq("active", true)
        .single();

      if (locationError) {
        console.error("Location lookup error:", locationError);

        if (locationError.code === "PGRST116") {
          setError("Location code not found.");
        } else {
          setError(`Database error: ${locationError.message}`);
        }

        return;
      }

      if (!location) {
        setError("Location code not found.");
        return;
      }

      onLocationSelected(location);
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Unable to connect to the database.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-app">
      <header className="login-header">
        <div className="login-brand">
          <div className="login-logo">🍴</div>

          <div>
            <div className="login-brand-name">SOUTH CAFÉ LA</div>

            <div className="login-brand-subtitle">OPERATIONS</div>
          </div>
        </div>

        <button className="supervisor-link" onClick={onSupervisor}>
          Supervisor Access
        </button>
      </header>

      <main className="login-main">
        <div className="login-card">
          <div className="welcome-icon"> </div>

          <h1>Welcome</h1>

          <p className="login-description">
            Enter your 4-digit location code to access your school.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="login-label">Location Code</label>

            <input
              className="location-input"
              type="text"
              inputMode="numeric"
              maxLength="4"
              placeholder="0000"
              value={locationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");

                setLocationCode(value);
                setError("");
              }}
              autoFocus
            />

            {error && <div className="login-error">{error}</div>}

            <button
              type="submit"
              className="login-primary-button"
              disabled={locationCode.length !== 4 || loading}
            >
              {loading ? "Loading..." : "Continue"}
            </button>
          </form>

          <div className="login-help">
            Don't know your location code?
            <br />
            Contact your Area Supervisor.
          </div>
        </div>
      </main>

      <footer className="login-footer">South Café LA Operations</footer>
    </div>
  );
}

export default LoginPage;
