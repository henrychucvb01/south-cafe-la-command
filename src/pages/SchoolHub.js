import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function SchoolHub({ location, employee, onFinishLine, onDashboard, onExit }) {
  const [mealCounts, setMealCounts] = useState([]);

  // Weekly / Monthly
  const [range, setRange] = useState("weekly");

  // all | breakfast | lunch | supper | total
  const [chartView, setChartView] = useState("all");

  const [loadingMeals, setLoadingMeals] = useState(true);
  const [mealError, setMealError] = useState("");

  // Pending Supper
  const [pendingSupper, setPendingSupper] = useState(null);
  const [supperInput, setSupperInput] = useState("");
  const [savingSupper, setSavingSupper] = useState(false);
  const [supperMessage, setSupperMessage] = useState("");

  /* =========================================================
     LOAD DATA
  ========================================================= */

  useEffect(() => {
    if (!location?.id) {
      return;
    }

    loadMealCounts();
    loadPendingSupper();
  }, [location?.id, range]);

  /* =========================================================
     DATE HELPERS
  ========================================================= */

  function getDateString(date) {
    return date.toISOString().split("T")[0];
  }

  function formatServiceDate(value) {
    if (!value) {
      return "";
    }

    return new Date(`${value}T12:00:00`).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatShortDate(value) {
    if (!value) {
      return "";
    }

    return new Date(`${value}T12:00:00`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  /* =========================================================
     LOAD MEAL COUNTS
  ========================================================= */

  async function loadMealCounts() {
    if (!location?.id) {
      return;
    }

    setLoadingMeals(true);
    setMealError("");

    try {
      const daysBack = range === "weekly" ? 14 : 45;

      const startDate = new Date();

      startDate.setDate(startDate.getDate() - daysBack);

      const startString = getDateString(startDate);

      const { data, error } = await supabase
        .from("meal_counts")
        .select("*")
        .eq("location_id", location.id)
        .gte("service_date", startString)
        .order("service_date", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setMealCounts(data || []);
    } catch (error) {
      console.error("Meal count load error:", error);

      setMealError(error.message || "Could not load meal counts.");
    } finally {
      setLoadingMeals(false);
    }
  }

  /* =========================================================
     FIND PENDING SUPPER
  ========================================================= */

  async function loadPendingSupper() {
    if (!location?.id) {
      return;
    }

    setSupperMessage("");

    try {
      const today = getDateString(new Date());

      const { data, error } = await supabase
        .from("meal_counts")
        .select("*")
        .eq("location_id", location.id)
        .eq("supper_status", "pending")
        .lt("service_date", today)
        .order("service_date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setPendingSupper(data || null);

      setSupperInput(data?.supper_count ?? "");
    } catch (error) {
      console.error("Pending Supper load error:", error);

      setSupperMessage(
        `Could not check pending Supper counts: ${error.message}`
      );
    }
  }

  /* =========================================================
     SAVE PENDING SUPPER
  ========================================================= */

  function handleSupperChange(value) {
    const clean = value.replace(/\D/g, "");

    setSupperInput(clean);
    setSupperMessage("");
  }

  async function savePendingSupper() {
    if (!pendingSupper) {
      return;
    }

    if (supperInput === "") {
      setSupperMessage("Enter the final Supper count.");

      return;
    }

    setSavingSupper(true);
    setSupperMessage("");

    try {
      const { error } = await supabase
        .from("meal_counts")
        .update({
          supper_count: Number(supperInput),

          supper_status: "complete",

          entered_by: employee?.employee_name || "Covering Employee",

          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingSupper.id);

      if (error) {
        throw error;
      }

      setPendingSupper(null);
      setSupperInput("");

      await loadMealCounts();
      await loadPendingSupper();
    } catch (error) {
      console.error("Supper save error:", error);

      setSupperMessage(`Could not save Supper count: ${error.message}`);
    } finally {
      setSavingSupper(false);
    }
  }

  /* =========================================================
     CHART VIEW
  ========================================================= */

  function handleChartView(view) {
    setChartView((current) => (current === view ? "all" : view));
  }

  /* =========================================================
     CHART DATA
  ========================================================= */

  const chartData = useMemo(() => {
    let rows = [...mealCounts];

    if (range === "weekly") {
      rows = rows.slice(-5);
    }

    if (range === "monthly") {
      rows = rows.slice(-22);
    }

    return rows.map((row) => {
      const breakfast = row.breakfast_count ?? 0;

      const lunch = row.lunch_count ?? 0;

      const supper =
        row.supper_status === "pending" ? null : row.supper_count ?? 0;

      const total = breakfast + lunch + (supper ?? 0);

      return {
        date: formatShortDate(row.service_date),

        breakfast,
        lunch,
        supper,
        total,

        supperPending: row.supper_status === "pending",
      };
    });
  }, [mealCounts, range]);

  /* =========================================================
     LATEST COUNTS
  ========================================================= */

  const latest =
    mealCounts.length > 0 ? mealCounts[mealCounts.length - 1] : null;

  const latestBreakfast = latest?.breakfast_count ?? 0;

  const latestLunch = latest?.lunch_count ?? 0;

  const latestSupper = latest?.supper_count;

  const latestTotal = latestBreakfast + latestLunch + (latestSupper ?? 0);

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="login-app">
      {/* HEADER */}

      <header className="login-header">
        <div className="login-brand">
          <div className="login-logo">🍴</div>

          <div>
            <div className="login-brand-name">SOUTH CAFÉ LA</div>

            <div className="login-brand-subtitle">OPERATIONS</div>
          </div>
        </div>
      </header>

      <main className="login-main">
        <div className="school-dashboard-page">
          {/* =================================================
              SCHOOL HEADER
          ================================================= */}

          <div className="school-dashboard-header">
            <div>
              <div className="dashboard-small-label">
                LOCATION {location?.location_code}
              </div>

              <h1>{location?.school_name}</h1>

              <p>
                Signed in as <strong>{employee?.employee_name}</strong>
              </p>
            </div>

            <button className="dashboard-exit" onClick={onExit}>
              Exit Location
            </button>
          </div>

          {/* =================================================
              PENDING SUPPER
          ================================================= */}

          {pendingSupper && (
            <section
              className="dashboard-card"
              style={{
                border: "1px solid #e7cb70",

                background: "#fffaf0",
              }}
            >
              <div className="school-dashboard-section-title">
                <div>
                  <h2>Action Needed — Supper Count</h2>

                  <p>
                    Enter the final Supper count from the previous service day.
                  </p>
                </div>

                <span
                  style={{
                    background: "#fff0bd",

                    color: "#775a00",

                    borderRadius: "6px",

                    padding: "5px 8px",

                    fontSize: "9px",

                    fontWeight: "800",
                  }}
                >
                  PENDING
                </span>
              </div>

              <div
                style={{
                  display: "grid",

                  gridTemplateColumns: "1fr 180px auto",

                  gap: "12px",

                  alignItems: "end",
                }}
              >
                <div>
                  <small
                    style={{
                      display: "block",
                      color: "#7c8792",
                      marginBottom: "4px",
                    }}
                  >
                    Service Date
                  </small>

                  <strong>
                    {formatServiceDate(pendingSupper.service_date)}
                  </strong>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "10px",
                      fontWeight: "800",
                      marginBottom: "5px",
                    }}
                  >
                    Final Supper Count
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter count"
                    value={supperInput}
                    onChange={(e) => handleSupperChange(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #d6dfe7",
                      borderRadius: "7px",
                      padding: "10px",
                      fontSize: "14px",
                      fontWeight: "700",
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="finish-line-submit finish-line-ready"
                  disabled={savingSupper || supperInput === ""}
                  onClick={savePendingSupper}
                >
                  {savingSupper ? "Saving..." : "Save Supper Count"}
                </button>
              </div>

              {supperMessage && (
                <div
                  className="login-error"
                  style={{
                    marginTop: "10px",
                  }}
                >
                  {supperMessage}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              TODAY'S OPERATIONS
          ================================================= */}

          <section className="dashboard-card">
            <div className="school-dashboard-section-title">
              <div>
                <h2>Today's Operations</h2>

                <p>Complete your daily Finish Line.</p>
              </div>
            </div>

            <button className="hub-action primary" onClick={onFinishLine}>
              <div className="hub-action-icon">🏁</div>

              <div>
                <strong>Finish Line Check</strong>

                <small>Complete today's end-of-day verification</small>
              </div>

              <span>›</span>
            </button>

            <button className="hub-action" onClick={onDashboard}>
              <div className="hub-action-icon">📋</div>

              <div>
                <strong>Finish Line History</strong>

                <small>Review today's status and previous submissions</small>
              </div>

              <span>›</span>
            </button>
          </section>

          {/* =================================================
              LATEST MEAL COUNTS
          ================================================= */}

          <section className="dashboard-card">
            <div className="school-dashboard-section-title">
              <div>
                <h2>Latest Meal Counts</h2>

                <p>Click a meal service to filter the graph.</p>
              </div>

              {latest && (
                <span className="school-dashboard-status complete">
                  {formatShortDate(latest.service_date)}
                </span>
              )}
            </div>

            {!latest ? (
              <div className="school-empty-history">
                No meal-count data yet.
              </div>
            ) : (
              <div className="meal-summary-grid">
                {/* BREAKFAST */}

                <button
                  type="button"
                  className={`meal-summary-card meal-summary-button ${
                    chartView === "breakfast" ? "selected" : ""
                  }`}
                  onClick={() => handleChartView("breakfast")}
                >
                  <span>Breakfast</span>

                  <strong>{latestBreakfast.toLocaleString()}</strong>
                </button>

                {/* LUNCH */}

                <button
                  type="button"
                  className={`meal-summary-card meal-summary-button ${
                    chartView === "lunch" ? "selected" : ""
                  }`}
                  onClick={() => handleChartView("lunch")}
                >
                  <span>Lunch</span>

                  <strong>{latestLunch.toLocaleString()}</strong>
                </button>

                {/* SUPPER */}

                <button
                  type="button"
                  className={`meal-summary-card meal-summary-button ${
                    chartView === "supper" ? "selected" : ""
                  }`}
                  onClick={() => handleChartView("supper")}
                >
                  <span>Supper</span>

                  <strong>
                    {latestSupper === null
                      ? "Pending"
                      : latestSupper.toLocaleString()}
                  </strong>
                </button>

                {/* TOTAL */}

                <button
                  type="button"
                  className={`meal-summary-card meal-summary-button ${
                    chartView === "total" ? "selected" : ""
                  }`}
                  onClick={() => handleChartView("total")}
                >
                  <span>Total</span>

                  <strong>{latestTotal.toLocaleString()}</strong>

                  {latestSupper === null && <small>Supper pending</small>}
                </button>
              </div>
            )}
          </section>

          {/* =================================================
              MEAL COUNT TREND
          ================================================= */}

          <section className="dashboard-card">
            <div className="school-dashboard-section-title">
              <div>
                <h2>Meal Count Trend</h2>

                <p>
                  {chartView === "all" && "Breakfast, Lunch & Supper"}

                  {chartView === "breakfast" && "Breakfast trend"}

                  {chartView === "lunch" && "Lunch trend"}

                  {chartView === "supper" && "Supper trend"}

                  {chartView === "total" && "Daily total trend"}

                  {" • "}

                  {range === "weekly"
                    ? "Last 5 service days"
                    : "Last 22 service days"}
                </p>
              </div>

              {/* WEEKLY / MONTHLY */}

              <div className="meal-range-toggle">
                <button
                  type="button"
                  className={range === "weekly" ? "active" : ""}
                  onClick={() => setRange("weekly")}
                >
                  Weekly
                </button>

                <button
                  type="button"
                  className={range === "monthly" ? "active" : ""}
                  onClick={() => setRange("monthly")}
                >
                  Monthly
                </button>
              </div>
            </div>

            {mealError && <div className="login-error">{mealError}</div>}

            {loadingMeals ? (
              <div className="school-empty-history">Loading meal trends...</div>
            ) : chartData.length === 0 ? (
              <div className="school-empty-history">
                No meal-count history available yet.
              </div>
            ) : (
              <div className="meal-chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 15,
                      right: 25,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="date" />

                    <YAxis />

                    <Tooltip />

                    <Legend />

                    {/* =================================
                        ALL SERVICES
                    ================================= */}

                    {chartView === "all" && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="breakfast"
                          name="Breakfast"
                          stroke="#2878d0"
                          strokeWidth={3}
                          connectNulls={false}
                          dot={{
                            r: 5,
                            fill: "#2878d0",
                            stroke: "#2878d0",
                          }}
                          activeDot={{
                            r: 7,
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="lunch"
                          name="Lunch"
                          stroke="#1b9b62"
                          strokeWidth={3}
                          connectNulls={false}
                          dot={{
                            r: 5,
                            fill: "#1b9b62",
                            stroke: "#1b9b62",
                          }}
                          activeDot={{
                            r: 7,
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="supper"
                          name="Supper"
                          stroke="#e58b23"
                          strokeWidth={3}
                          connectNulls={false}
                          dot={{
                            r: 5,
                            fill: "#e58b23",
                            stroke: "#e58b23",
                          }}
                          activeDot={{
                            r: 7,
                          }}
                        />
                      </>
                    )}

                    {/* =================================
                        BREAKFAST ONLY
                    ================================= */}

                    {(chartView === "all" || chartView === "breakfast") && (
                      <Line
                        type="monotone"
                        dataKey="breakfast"
                        name="Breakfast"
                        stroke="#2878d0"
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{
                          r: 5,
                          fill: "#2878d0",
                          stroke: "#2878d0",
                        }}
                        activeDot={{
                          r: 7,
                        }}
                      />
                    )}

                    {/* =================================
                        LUNCH ONLY
                    ================================= */}

                    {(chartView === "all" || chartView === "lunch") && (
                      <Line
                        type="monotone"
                        dataKey="lunch"
                        name="Lunch"
                        stroke="#1b9b62"
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{
                          r: 5,
                          fill: "#1b9b62",
                          stroke: "#1b9b62",
                        }}
                        activeDot={{
                          r: 7,
                        }}
                      />
                    )}

                    {/* =================================
                        SUPPER ONLY
                    ================================= */}

                    {(chartView === "all" || chartView === "supper") && (
                      <Line
                        type="monotone"
                        dataKey="supper"
                        name="Supper"
                        stroke="#e58b23"
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{
                          r: 5,
                          fill: "#e58b23",
                          stroke: "#e58b23",
                        }}
                        activeDot={{
                          r: 7,
                        }}
                      />
                    )}

                    {/* =================================
                        DAILY TOTAL
                    ================================= */}

                    {chartView === "total" && (
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Daily Total"
                        stroke="#5b4bb7"
                        strokeWidth={3}
                        connectNulls={false}
                        dot={{
                          r: 5,
                          fill: "#5b4bb7",
                          stroke: "#5b4bb7",
                        }}
                        activeDot={{
                          r: 7,
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default SchoolHub;
