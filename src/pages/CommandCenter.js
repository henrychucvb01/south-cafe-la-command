import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../supabaseClient";

function CommandCenter({ onExit, onPreviewFinishLine }) {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("dashboard");

  // =========================================
  // DASHBOARD DATE
  // =========================================

  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayString = getLocalDateString();
  const [dashboardDate, setDashboardDate] = useState(todayString);

  // =========================================
  // RECENT CHANGES
  // =========================================

  const [recentChanges, setRecentChanges] = useState([]);
  const [recentChangesLoading, setRecentChangesLoading] = useState(false);
  const [recentChangesError, setRecentChangesError] = useState("");
  const [historySchoolId, setHistorySchoolId] = useState("all");
  const [historyDate, setHistoryDate] = useState("");

  // =========================================
  // MEAL TRENDS
  // =========================================

  const [mealTrendData, setMealTrendData] = useState([]);
  const [mealTrendLoading, setMealTrendLoading] = useState(false);
  const [mealTrendError, setMealTrendError] = useState("");
  const [trendSchoolId, setTrendSchoolId] = useState("all");
  const [trendDays, setTrendDays] = useState(30);
  const [visibleMeals, setVisibleMeals] = useState({
    breakfast: true,
    lunch: true,
    supper: true,
    total: false,
  });

  // =========================================
  // SUPERVISOR TEST MODE
  // =========================================

  const [testDay, setTestDay] = useState("live");
  const [testMonthEnd, setTestMonthEnd] = useState(false);

  useEffect(() => {
    loadCommandCenter();
  }, [dashboardDate]);

  async function loadCommandCenter() {
    setLoading(true);
    setError("");

    try {
      const selectedDate = dashboardDate;

      // ACTIVE LOCATIONS
      const { data: locations, error: locationError } = await supabase
        .from("locations")
        .select("*")
        .eq("active", true)
        .order("school_name");

      if (locationError) {
        throw locationError;
      }

      // SELECTED DATE'S FINISH LINE CHECKS
      const { data: checks, error: checkError } = await supabase
        .from("finish_line_checks")
        .select(
          `
          *,
          finish_line_items (*)
        `
        )
        .eq("service_date", selectedDate);

      if (checkError) {
        throw checkError;
      }

      const merged = (locations || []).map((location) => {
        const check = (checks || []).find(
          (item) => item.location_id === location.id
        );

        const attentionItems =
          check?.finish_line_items?.filter(
            (item) => item.requires_attention === true
          ) || [];

        let overall = "not-submitted";

        if (check) {
          overall = check.status === "attention" ? "attention" : "good";
        }

        return {
          ...location,
          check,
          attentionItems,
          overall,
        };
      });

      setSchools(merged);

      setSelectedSchool((current) => {
        if (!merged.length) {
          return null;
        }

        if (current) {
          return merged.find((school) => school.id === current.id) || merged[0];
        }

        const firstAttention = merged.find(
          (school) => school.overall === "attention"
        );

        const firstMissing = merged.find(
          (school) => school.overall === "not-submitted"
        );

        return firstAttention || firstMissing || merged[0];
      });
    } catch (err) {
      console.error("Command Center error:", err);

      setError(err.message || "Could not load Command Center.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // MEAL TRENDS
  // =========================================

  useEffect(() => {
    if (view === "meal-trends") {
      loadMealTrends();
    }
  }, [view, trendSchoolId, trendDays]);

  async function loadMealTrends() {
    setMealTrendLoading(true);
    setMealTrendError("");

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (Number(trendDays) - 1));
      const startDateString = startDate.toISOString().split("T")[0];

      let query = supabase
        .from("meal_counts")
        .select(
          `
          location_id,
          service_date,
          breakfast_count,
          lunch_count,
          supper_count
        `
        )
        .gte("service_date", startDateString)
        .order("service_date", { ascending: true });

      if (trendSchoolId !== "all") {
        query = query.eq("location_id", trendSchoolId);
      }

      const { data, error: trendError } = await query;

      if (trendError) {
        throw trendError;
      }

      const grouped = {};

      (data || []).forEach((row) => {
        if (!grouped[row.service_date]) {
          grouped[row.service_date] = {
            service_date: row.service_date,
            breakfast: 0,
            lunch: 0,
            supper: 0,
          };
        }

        grouped[row.service_date].breakfast += Number(row.breakfast_count) || 0;
        grouped[row.service_date].lunch += Number(row.lunch_count) || 0;
        grouped[row.service_date].supper += Number(row.supper_count) || 0;
      });

      const formatted = Object.values(grouped)
        .sort((a, b) => new Date(a.service_date) - new Date(b.service_date))
        .map((day) => ({
          ...day,
          total: day.breakfast + day.lunch + day.supper,
          dateLabel: new Date(
            `${day.service_date}T12:00:00`
          ).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }),
        }));

      setMealTrendData(formatted);
    } catch (err) {
      console.error("Meal Trends error:", err);
      setMealTrendError(err.message || "Could not load meal trends.");
    } finally {
      setMealTrendLoading(false);
    }
  }

  function toggleMealLine(meal) {
    setVisibleMeals((current) => ({
      ...current,
      [meal]: !current[meal],
    }));
  }

  function openDashboard(filterName = "all") {
    setView("dashboard");
    setFilter(filterName);
  }

  function openMealTrends() {
    setView("meal-trends");
  }

  function openRecentChanges() {
    setView("recent-changes");
  }

  useEffect(() => {
    if (view === "recent-changes") {
      loadRecentChanges();
    }
  }, [view, historySchoolId, historyDate]);

  async function loadRecentChanges() {
    setRecentChangesLoading(true);
    setRecentChangesError("");

    try {
      let query = supabase.from("finish_line_audit_log").select("*");

      if (historySchoolId !== "all") {
        query = query.eq("location_id", historySchoolId);
      }

      if (historyDate) {
        query = query.eq("service_date", historyDate);
      }

      const { data, error: historyError } = await query.limit(500);

      if (historyError) {
        throw historyError;
      }

      const locationMap = new Map(
        schools.map((school) => [String(school.id), school])
      );

      const sorted = (data || [])
        .map((row) => ({
          ...row,
          school: locationMap.get(String(row.location_id)) || null,
        }))
        .sort((a, b) => {
          const aTime = new Date(
            a.created_at ||
              a.changed_at ||
              a.updated_at ||
              `${a.service_date}T00:00:00`
          ).getTime();
          const bTime = new Date(
            b.created_at ||
              b.changed_at ||
              b.updated_at ||
              `${b.service_date}T00:00:00`
          ).getTime();
          return bTime - aTime;
        })
        .slice(0, 50);

      setRecentChanges(sorted);
    } catch (err) {
      console.error("Recent Changes error:", err);
      setRecentChangesError(err.message || "Could not load recent changes.");
    } finally {
      setRecentChangesLoading(false);
    }
  }

  function changeDashboardDay(amount) {
    const date = new Date(`${dashboardDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    const nextDate = getLocalDateString(date);

    if (nextDate <= todayString) {
      setDashboardDate(nextDate);
    }
  }

  function returnDashboardToToday() {
    setDashboardDate(todayString);
  }

  // =========================================
  // TEST MODE HELPERS
  // =========================================

  function getPreviewDayName() {
    if (testDay === "live") {
      return "Live";
    }

    const names = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
    };

    return names[Number(testDay)] || "Live";
  }

  const supervisorTestMode = testDay !== "live" || testMonthEnd;

  function handlePreviewFinishLine() {
    if (!onPreviewFinishLine) {
      return;
    }

    onPreviewFinishLine({
      day: testDay === "live" ? null : Number(testDay),

      monthEnd: testMonthEnd,
    });
  }

  // =========================================
  // SUMMARY
  // =========================================

  const summary = useMemo(() => {
    const good = schools.filter((school) => school.overall === "good").length;

    const attention = schools.filter(
      (school) => school.overall === "attention"
    ).length;

    const missing = schools.filter(
      (school) => school.overall === "not-submitted"
    ).length;

    const submitted = schools.length - missing;

    const completion =
      schools.length > 0 ? Math.round((submitted / schools.length) * 100) : 0;

    return {
      good,
      attention,
      missing,
      submitted,
      completion,
    };
  }, [schools]);

  const filteredSchools = useMemo(() => {
    if (filter === "all") {
      return schools;
    }

    return schools.filter((school) => school.overall === filter);
  }, [schools, filter]);

  const attentionSchools = schools.filter(
    (school) => school.overall === "attention"
  );

  const missingSchools = schools.filter(
    (school) => school.overall === "not-submitted"
  );

  const totalFlaggedItems = attentionSchools.reduce(
    (total, school) => total + school.attentionItems.length,
    0
  );

  // =========================================
  // FORMATTERS
  // =========================================

  function formatTime(value) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    return new Date(`${value}T12:00:00`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="command-loading">
        Loading South Café LA Command Center...
      </div>
    );
  }

  return (
    <div className="command-app">
      {/* =====================================
          SIDEBAR
      ===================================== */}

      <aside className="command-sidebar">
        <div className="command-brand">
          <div className="command-brand-icon">🍴</div>

          <div>
            <strong>SOUTH CAFÉ LA</strong>

            <span>COMMAND CENTER</span>
          </div>
        </div>

        <nav className="command-nav">
          <button
            className={`command-nav-button ${
              view === "dashboard" && filter === "all" ? "active" : ""
            }`}
            onClick={() => openDashboard("all")}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <div className="command-nav-label">OPERATIONS</div>

          <button
            className={`command-nav-button ${
              view === "dashboard" && filter === "good" ? "active" : ""
            }`}
            onClick={() => openDashboard("good")}
          >
            <span>✓</span>
            All Good
          </button>

          <button
            className={`command-nav-button ${
              view === "dashboard" && filter === "attention" ? "active" : ""
            }`}
            onClick={() => openDashboard("attention")}
          >
            <span>⚠</span>
            Needs Attention
            {summary.attention > 0 && (
              <span className="command-badge">{summary.attention}</span>
            )}
          </button>

          <button
            className={`command-nav-button ${
              view === "dashboard" && filter === "not-submitted" ? "active" : ""
            }`}
            onClick={() => openDashboard("not-submitted")}
          >
            <span>🏁</span>
            Not Submitted
            {summary.missing > 0 && (
              <span className="command-badge">{summary.missing}</span>
            )}
          </button>

          <button
            className={`command-nav-button ${
              view === "meal-trends" ? "active" : ""
            }`}
            onClick={openMealTrends}
          >
            <span>📊</span>
            Meal Trends
          </button>

          <button
            className={`command-nav-button ${
              view === "recent-changes" ? "active" : ""
            }`}
            onClick={openRecentChanges}
          >
            <span>↺</span>
            Recent Changes
          </button>
        </nav>

        <button className="command-exit" onClick={onExit}>
          ← Exit Supervisor View
        </button>
      </aside>

      {/* =====================================
          MAIN
      ===================================== */}

      <main className="command-main">
        {/* TOP BAR */}

        <header className="command-topbar">
          <div>
            <h2>
              {view === "meal-trends"
                ? "South Café LA Meal Trends"
                : view === "recent-changes"
                ? "South Café LA Recent Changes"
                : "South Café LA Command Center"}
            </h2>

            <p>
              {view === "meal-trends"
                ? "Meal participation trends across active locations."
                : view === "recent-changes"
                ? "Recent edits made to submitted Finish Line Checks."
                : `Finish Line status for ${formatDate(
                    dashboardDate
                  )} across all active locations.`}
            </p>
          </div>

          <div className="command-top-actions">
            {view === "dashboard" && (
              <>
                {/* TEST DAY */}

                <div className="supervisor-test-controls">
                  <select
                    className="supervisor-test-select"
                    value={testDay}
                    onChange={(e) => setTestDay(e.target.value)}
                  >
                    <option value="live">Live Mode</option>
                    <option value="1">Test Monday</option>
                    <option value="2">Test Tuesday</option>
                    <option value="3">Test Wednesday</option>
                    <option value="4">Test Thursday</option>
                    <option value="5">Test Friday</option>
                  </select>

                  <label className="supervisor-month-end-toggle">
                    <input
                      type="checkbox"
                      checked={testMonthEnd}
                      onChange={(e) => setTestMonthEnd(e.target.checked)}
                    />
                    Month-End
                  </label>
                </div>
              </>
            )}

            <button
              className="command-refresh"
              onClick={
                view === "meal-trends"
                  ? loadMealTrends
                  : view === "recent-changes"
                  ? loadRecentChanges
                  : loadCommandCenter
              }
            >
              ↻ Refresh
            </button>

            {view === "dashboard" ? (
              <div
                className="command-date"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <button
                  type="button"
                  className="command-small-button"
                  onClick={() => changeDashboardDay(-1)}
                  title="Previous day"
                >
                  ‹
                </button>

                <input
                  type="date"
                  value={dashboardDate}
                  max={todayString}
                  onChange={(e) => setDashboardDate(e.target.value)}
                  style={{
                    border: "1px solid #d7dee5",
                    borderRadius: "7px",
                    padding: "7px 9px",
                    fontWeight: "700",
                    background: "white",
                  }}
                />

                <button
                  type="button"
                  className="command-small-button"
                  onClick={() => changeDashboardDay(1)}
                  disabled={dashboardDate >= todayString}
                  title="Next day"
                >
                  ›
                </button>

                {dashboardDate !== todayString && (
                  <button
                    type="button"
                    className="command-small-button"
                    onClick={returnDashboardToToday}
                  >
                    Today
                  </button>
                )}
              </div>
            ) : (
              <div className="command-date">
                📅 {new Date().toLocaleDateString()}
              </div>
            )}
          </div>
        </header>

        <div className="command-content">
          {view === "meal-trends" ? (
            <MealTrendsView
              schools={schools}
              mealTrendData={mealTrendData}
              mealTrendLoading={mealTrendLoading}
              mealTrendError={mealTrendError}
              trendSchoolId={trendSchoolId}
              setTrendSchoolId={setTrendSchoolId}
              trendDays={trendDays}
              setTrendDays={setTrendDays}
              visibleMeals={visibleMeals}
              toggleMealLine={toggleMealLine}
              loadMealTrends={loadMealTrends}
            />
          ) : view === "recent-changes" ? (
            <RecentChangesView
              schools={schools}
              recentChanges={recentChanges}
              recentChangesLoading={recentChangesLoading}
              recentChangesError={recentChangesError}
              historySchoolId={historySchoolId}
              setHistorySchoolId={setHistorySchoolId}
              historyDate={historyDate}
              setHistoryDate={setHistoryDate}
              loadRecentChanges={loadRecentChanges}
              formatDate={formatDate}
              formatTime={formatTime}
            />
          ) : (
            <>
              {error && <div className="command-error">{error}</div>}

              {/* =================================
              TEST MODE
          ================================= */}

              {supervisorTestMode && (
                <div className="supervisor-test-banner">
                  <div>
                    <strong> SUPERVISOR TEST MODE </strong>

                    <span>
                      {getPreviewDayName()}

                      {testMonthEnd ? " + Month-End" : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <button type="button" onClick={handlePreviewFinishLine}>
                      Preview Manager Finish Line →
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTestDay("live");
                        setTestMonthEnd(false);
                      }}
                    >
                      Live Mode
                    </button>
                  </div>
                </div>
              )}

              {/* =================================
              SUMMARY CARDS
          ================================= */}

              <section className="command-stats">
                <button
                  className="command-stat-card clickable-card"
                  onClick={() => setFilter("good")}
                >
                  <div className="command-stat-icon green">✓</div>

                  <div>
                    <span>All Good</span>

                    <strong>{summary.good}</strong>

                    <small>Finish Line complete</small>
                  </div>
                </button>

                <button
                  className="command-stat-card clickable-card"
                  onClick={() => setFilter("attention")}
                >
                  <div className="command-stat-icon yellow">!</div>

                  <div>
                    <span>Needs Attention</span>

                    <strong>{summary.attention}</strong>

                    <small>{totalFlaggedItems} flagged items</small>
                  </div>
                </button>

                <button
                  className="command-stat-card clickable-card"
                  onClick={() => setFilter("not-submitted")}
                >
                  <div className="command-stat-icon red">×</div>

                  <div>
                    <span>Not Submitted</span>

                    <strong>{summary.missing}</strong>

                    <small>Finish Line missing</small>
                  </div>
                </button>

                <div className="command-stat-card completion">
                  <div>
                    <span>Overall Completion</span>

                    <strong>{summary.completion}%</strong>

                    <small>
                      {summary.submitted} of {schools.length} submitted
                    </small>
                  </div>

                  <div
                    className="command-donut"
                    style={{
                      background: `conic-gradient(
                    #15aa5d 0deg ${summary.completion * 3.6}deg,
                    #e8edf2 ${summary.completion * 3.6}deg 360deg
                  )`,
                    }}
                  />
                </div>
              </section>

              {/* =================================
              NEEDS ATTENTION
          ================================= */}

              <section className="command-attention-card">
                <div className="command-section-header">
                  <div>
                    <h3>What Needs Your Attention</h3>

                    <p>Exceptions requiring supervisor review.</p>
                  </div>
                </div>

                <div className="command-attention-grid">
                  <button
                    className="command-attention-item"
                    onClick={() => setFilter("not-submitted")}
                  >
                    <span className="attention-circle red">🏁</span>

                    <div>
                      <strong>Missing Finish Line</strong>

                      <small>{summary.missing} schools</small>
                    </div>
                  </button>

                  <button
                    className="command-attention-item"
                    onClick={() => setFilter("attention")}
                  >
                    <span className="attention-circle yellow">⚠</span>

                    <div>
                      <strong>Flagged Finish Line Items</strong>

                      <small>{totalFlaggedItems} items</small>
                    </div>
                  </button>

                  <button
                    className="command-attention-item"
                    onClick={() => setFilter("good")}
                  >
                    <span className="attention-circle blue">✓</span>

                    <div>
                      <strong>Completed Cleanly</strong>

                      <small>{summary.good} schools</small>
                    </div>
                  </button>
                </div>
              </section>

              {/* =================================
              PRIORITY EXCEPTIONS
          ================================= */}

              {(attentionSchools.length > 0 || missingSchools.length > 0) && (
                <section className="dashboard-card">
                  <div className="command-section-header">
                    <div>
                      <h3>Priority Exceptions</h3>

                      <p>Start here before reviewing all schools.</p>
                    </div>
                  </div>

                  <div className="priority-exception-list">
                    {attentionSchools.slice(0, 5).map((school) => (
                      <button
                        key={`attention-${school.id}`}
                        className="priority-exception-row"
                        onClick={() => {
                          setFilter("attention");

                          setSelectedSchool(school);
                        }}
                      >
                        <span className="priority-dot attention">!</span>

                        <div>
                          <strong>{school.school_name}</strong>

                          <small>
                            {school.attentionItems
                              .map((item) => item.item_label)
                              .join(" • ")}
                          </small>
                        </div>

                        <span>
                          {school.attentionItems.length} issue
                          {school.attentionItems.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}

                    {missingSchools.slice(0, 5).map((school) => (
                      <button
                        key={`missing-${school.id}`}
                        className="priority-exception-row"
                        onClick={() => {
                          setFilter("not-submitted");

                          setSelectedSchool(school);
                        }}
                      >
                        <span className="priority-dot missing">—</span>

                        <div>
                          <strong>{school.school_name}</strong>

                          <small>
                            Finish Line has not been submitted today.
                          </small>
                        </div>

                        <span>Missing</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* =================================
              FILTER
          ================================= */}

              <div className="command-filter-bar">
                <div>
                  <strong>Showing:</strong>

                  <span>
                    {filter === "all" && " All Schools"}

                    {filter === "good" && " All Good"}

                    {filter === "attention" && " Needs Attention"}

                    {filter === "not-submitted" && " Not Submitted"}
                  </span>
                </div>

                {filter !== "all" && (
                  <button onClick={() => setFilter("all")}>Clear Filter</button>
                )}
              </div>

              {/* =================================
              SCHOOL TABLE
          ================================= */}

              <section className="command-workspace">
                <div className="command-school-card">
                  <div className="command-section-header">
                    <div>
                      <h3>School Status Overview</h3>

                      <p>
                        Click a school to review the selected date's Finish
                        Line.
                      </p>
                    </div>

                    <button
                      className="command-small-button"
                      onClick={loadCommandCenter}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="command-table-wrap">
                    <table className="command-table">
                      <thead>
                        <tr>
                          <th>School</th>
                          <th>Location</th>
                          <th>Submitted By</th>
                          <th>Time</th>
                          <th>Issues</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredSchools.map((school) => (
                          <tr
                            key={school.id}
                            onClick={() => setSelectedSchool(school)}
                            className={
                              selectedSchool?.id === school.id
                                ? "command-selected-row"
                                : ""
                            }
                          >
                            <td className="command-school-name">
                              <span
                                className={`command-row-line ${school.overall}`}
                              />

                              {school.school_name}
                            </td>

                            <td>{school.location_code}</td>

                            <td>{school.check?.employee_name || "—"}</td>

                            <td>{formatTime(school.check?.submitted_at)}</td>

                            <td>{school.attentionItems.length}</td>

                            <td>
                              {school.overall === "good" && (
                                <span className="command-status good">✓</span>
                              )}

                              {school.overall === "attention" && (
                                <span className="command-status attention">
                                  !
                                </span>
                              )}

                              {school.overall === "not-submitted" && (
                                <span className="command-status missing">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredSchools.length === 0 && (
                      <div className="command-empty-table">
                        No schools match this filter.
                      </div>
                    )}
                  </div>
                </div>

                {/* =================================
                SCHOOL DETAIL
            ================================= */}

                <aside className="command-detail-panel">
                  {selectedSchool ? (
                    <>
                      <div className="command-detail-header">
                        <div className="command-detail-location">
                          LOCATION {selectedSchool.location_code}
                        </div>

                        <h2>{selectedSchool.school_name}</h2>

                        <span
                          className={`command-detail-pill ${selectedSchool.overall}`}
                        >
                          {selectedSchool.overall === "good" && "All Good"}

                          {selectedSchool.overall === "attention" &&
                            "Needs Attention"}

                          {selectedSchool.overall === "not-submitted" &&
                            "Not Submitted"}
                        </span>
                      </div>

                      {selectedSchool.check ? (
                        <div className="command-detail-body">
                          <div className="command-submission-info">
                            <div>
                              <small>Service Date</small>

                              <strong>
                                {formatDate(selectedSchool.check.service_date)}
                              </strong>
                            </div>

                            <div>
                              <small>Submitted</small>

                              <strong>
                                {formatTime(selectedSchool.check.submitted_at)}
                              </strong>
                            </div>

                            <div>
                              <small>Submitted By</small>

                              <strong>
                                {selectedSchool.check.employee_name}
                              </strong>
                            </div>

                            <div>
                              <small>Flagged Items</small>

                              <strong>
                                {selectedSchool.attentionItems.length}
                              </strong>
                            </div>
                          </div>

                          {selectedSchool.attentionItems.length > 0 && (
                            <div className="command-flag-box">
                              <h4>⚠ Follow-Up Needed</h4>

                              {selectedSchool.attentionItems.map((item) => (
                                <div key={item.id}>• {item.item_label}</div>
                              ))}
                            </div>
                          )}

                          <h3>Full Finish Line</h3>

                          <div className="command-detail-list">
                            {selectedSchool.check.finish_line_items?.map(
                              (item) => (
                                <div
                                  className="command-detail-row"
                                  key={item.id}
                                >
                                  <span>{item.item_label}</span>

                                  <div className="command-answer">
                                    <span
                                      className={`command-answer-dot ${
                                        item.requires_attention ? "bad" : "good"
                                      }`}
                                    >
                                      {item.requires_attention ? "!" : "✓"}
                                    </span>

                                    <strong>
                                      {String(item.answer || "—").toUpperCase()}
                                    </strong>
                                  </div>
                                </div>
                              )
                            )}
                          </div>

                          {selectedSchool.check.comments && (
                            <div className="command-comments">
                              <h4>Manager Comments</h4>

                              <p>{selectedSchool.check.comments}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="command-no-submission">
                          <div>🏁</div>

                          <h3>Finish Line Not Submitted</h3>

                          <p>
                            No Finish Line Check has been submitted for this
                            location today.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="command-no-submission">
                      Select a school.
                    </div>
                  )}
                </aside>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function RecentChangesView({
  schools,
  recentChanges,
  recentChangesLoading,
  recentChangesError,
  historySchoolId,
  setHistorySchoolId,
  historyDate,
  setHistoryDate,
  loadRecentChanges,
  formatDate,
  formatTime,
}) {
  function formatAuditValue(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const text = String(value);

    if (text.toLowerCase() === "yes") return "YES";
    if (text.toLowerCase() === "no") return "NO";
    if (text.toLowerCase() === "complete") return "COMPLETE";
    if (text.toLowerCase() === "attention") return "NEEDS ATTENTION";

    return text;
  }

  function changeTimestamp(row) {
    return row.created_at || row.changed_at || row.updated_at || null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <section className="dashboard-card" style={{ padding: "22px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "800",
                color: "#6b7785",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: "5px",
              }}
            >
              Audit History
            </div>

            <h2 style={{ margin: 0, fontSize: "24px" }}>Recent Changes</h2>

            <p style={{ margin: "6px 0 0", color: "#687583" }}>
              Latest edits to submitted Finish Line Checks. Newest changes
              appear first.
            </p>
          </div>

          <button
            type="button"
            className="command-small-button"
            onClick={loadRecentChanges}
          >
            ↻ Refresh
          </button>
        </div>
      </section>

      <section className="dashboard-card" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            gap: "15px",
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "260px", flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "800",
                marginBottom: "6px",
                textTransform: "uppercase",
                color: "#6c7884",
              }}
            >
              Location
            </label>

            <select
              value={historySchoolId}
              onChange={(e) => setHistorySchoolId(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #d9e0e6",
                borderRadius: "8px",
                padding: "10px 12px",
                background: "white",
                fontWeight: "700",
              }}
            >
              <option value="all">All Schools</option>

              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: "190px" }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "800",
                marginBottom: "6px",
                textTransform: "uppercase",
                color: "#6c7884",
              }}
            >
              Service Date
            </label>

            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #d9e0e6",
                borderRadius: "8px",
                padding: "9px 12px",
                background: "white",
                fontWeight: "700",
              }}
            />
          </div>

          {(historySchoolId !== "all" || historyDate) && (
            <button
              type="button"
              className="command-small-button"
              onClick={() => {
                setHistorySchoolId("all");
                setHistoryDate("");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      <section className="dashboard-card">
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #edf0f3",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Change History</h3>
            <p
              style={{ margin: "4px 0 0", color: "#71808e", fontSize: "12px" }}
            >
              Showing up to the 50 most recent matching changes.
            </p>
          </div>

          {!recentChangesLoading && (
            <strong style={{ fontSize: "12px", color: "#6d7985" }}>
              {recentChanges.length} change
              {recentChanges.length === 1 ? "" : "s"}
            </strong>
          )}
        </div>

        {recentChangesError && (
          <div className="command-error" style={{ margin: "16px" }}>
            {recentChangesError}
          </div>
        )}

        {recentChangesLoading ? (
          <div
            style={{
              minHeight: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6d7985",
              fontWeight: "700",
            }}
          >
            Loading recent changes...
          </div>
        ) : recentChanges.length === 0 ? (
          <div
            style={{
              minHeight: "300px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#73808d",
              textAlign: "center",
              padding: "20px",
            }}
          >
            <div style={{ fontSize: "34px", marginBottom: "10px" }}>↺</div>
            <strong>No changes found</strong>
            <small style={{ marginTop: "5px" }}>
              Edited Finish Line answers will appear here after a submitted
              check is changed.
            </small>
          </div>
        ) : (
          <div className="command-table-wrap">
            <table className="command-table">
              <thead>
                <tr>
                  <th>Changed</th>
                  <th>Service Date</th>
                  <th>School</th>
                  <th>Changed By</th>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>

              <tbody>
                {recentChanges.map((row, index) => {
                  const stamp = changeTimestamp(row);

                  return (
                    <tr
                      key={
                        row.id ||
                        `${row.finish_line_check_id}-${row.field_name}-${index}`
                      }
                    >
                      <td>
                        {stamp ? (
                          <>
                            <strong>
                              {new Date(stamp).toLocaleDateString()}
                            </strong>
                            <div style={{ fontSize: "10px", color: "#788590" }}>
                              {formatTime(stamp)}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>{formatDate(row.service_date)}</td>

                      <td>
                        <strong>
                          {row.school?.school_name || "Unknown Location"}
                        </strong>
                        {row.school?.location_code && (
                          <div style={{ fontSize: "10px", color: "#788590" }}>
                            Location {row.school.location_code}
                          </div>
                        )}
                      </td>

                      <td>{row.employee_name || "—"}</td>
                      <td>
                        <strong>{row.field_name || "—"}</strong>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "220px",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            color: "#7a4650",
                          }}
                        >
                          {formatAuditValue(row.old_value)}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "220px",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            fontWeight: "700",
                            color: "#19663d",
                          }}
                        >
                          {formatAuditValue(row.new_value)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MealTrendsView({
  schools,
  mealTrendData,
  mealTrendLoading,
  mealTrendError,
  trendSchoolId,
  setTrendSchoolId,
  trendDays,
  setTrendDays,
  visibleMeals,
  toggleMealLine,
  loadMealTrends,
}) {
  const selectedSchool =
    trendSchoolId === "all"
      ? null
      : schools.find((school) => String(school.id) === String(trendSchoolId));

  const totals = mealTrendData.reduce(
    (summary, day) => {
      summary.breakfast += day.breakfast || 0;
      summary.lunch += day.lunch || 0;
      summary.supper += day.supper || 0;
      summary.total += day.total || 0;
      return summary;
    },
    {
      breakfast: 0,
      lunch: 0,
      supper: 0,
      total: 0,
    }
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <section className="dashboard-card" style={{ padding: "22px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "800",
                color: "#6b7785",
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: "5px",
              }}
            >
              Operations Analytics
            </div>

            <h2 style={{ margin: 0, fontSize: "24px" }}>Meal Trends</h2>

            <p style={{ margin: "6px 0 0", color: "#687583" }}>
              {selectedSchool
                ? selectedSchool.school_name
                : "All active locations"}
            </p>
          </div>

          <button
            type="button"
            className="command-small-button"
            onClick={loadMealTrends}
          >
            ↻ Refresh
          </button>
        </div>
      </section>

      <section className="dashboard-card" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            gap: "15px",
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "260px", flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "800",
                marginBottom: "6px",
                textTransform: "uppercase",
                color: "#6c7884",
              }}
            >
              Location
            </label>

            <select
              value={trendSchoolId}
              onChange={(e) => setTrendSchoolId(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #d9e0e6",
                borderRadius: "8px",
                padding: "10px 12px",
                background: "white",
                fontWeight: "700",
              }}
            >
              <option value="all">All Schools</option>

              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: "160px" }}>
            <label
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: "800",
                marginBottom: "6px",
                textTransform: "uppercase",
                color: "#6c7884",
              }}
            >
              Date Range
            </label>

            <select
              value={trendDays}
              onChange={(e) => setTrendDays(Number(e.target.value))}
              style={{
                width: "100%",
                border: "1px solid #d9e0e6",
                borderRadius: "8px",
                padding: "10px 12px",
                background: "white",
                fontWeight: "700",
              }}
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <MealTrendStat label="Breakfast" value={totals.breakfast} />
        <MealTrendStat label="Lunch" value={totals.lunch} />
        <MealTrendStat label="Supper" value={totals.supper} />
        <MealTrendStat label="Total Meals" value={totals.total} />
      </section>

      <section className="dashboard-card" style={{ padding: "22px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "20px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Daily Meal Participation</h3>
            <p
              style={{
                margin: "4px 0 0",
                color: "#71808e",
                fontSize: "12px",
              }}
            >
              Click a meal below to show or hide its line.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <TrendToggle
              active={visibleMeals.breakfast}
              onClick={() => toggleMealLine("breakfast")}
              label="Breakfast"
              color="#e7a52e"
            />
            <TrendToggle
              active={visibleMeals.lunch}
              onClick={() => toggleMealLine("lunch")}
              label="Lunch"
              color="#2a78d1"
            />
            <TrendToggle
              active={visibleMeals.supper}
              onClick={() => toggleMealLine("supper")}
              label="Supper"
              color="#8a56c7"
            />
            <TrendToggle
              active={visibleMeals.total}
              onClick={() => toggleMealLine("total")}
              label="Total"
              color="#1e2935"
            />
          </div>
        </div>

        {mealTrendError && (
          <div className="command-error">{mealTrendError}</div>
        )}

        {mealTrendLoading ? (
          <div
            style={{
              height: "390px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6d7985",
              fontWeight: "700",
            }}
          >
            Loading meal trends...
          </div>
        ) : mealTrendData.length === 0 ? (
          <div
            style={{
              height: "390px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#73808d",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "34px", marginBottom: "10px" }}>📊</div>
            <strong>No meal-count history yet</strong>
            <small style={{ marginTop: "5px" }}>
              Meal counts will appear here as managers complete Finish Line
              Checks.
            </small>
          </div>
        ) : (
          <div style={{ width: "100%", height: "390px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mealTrendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e7ebef"
                />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #dce3e8",
                    boxShadow: "0 6px 18px rgba(0,0,0,.08)",
                  }}
                />

                {visibleMeals.breakfast && (
                  <Line
                    type="monotone"
                    dataKey="breakfast"
                    name="Breakfast"
                    stroke="#e7a52e"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {visibleMeals.lunch && (
                  <Line
                    type="monotone"
                    dataKey="lunch"
                    name="Lunch"
                    stroke="#2a78d1"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {visibleMeals.supper && (
                  <Line
                    type="monotone"
                    dataKey="supper"
                    name="Supper"
                    stroke="#8a56c7"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {visibleMeals.total && (
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Meals"
                    stroke="#1e2935"
                    strokeWidth={4}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {mealTrendData.length > 0 && (
        <section className="dashboard-card">
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid #edf0f3",
            }}
          >
            <h3 style={{ margin: 0 }}>Daily Counts</h3>
          </div>

          <div className="command-table-wrap">
            <table className="command-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Breakfast</th>
                  <th>Lunch</th>
                  <th>Supper</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {[...mealTrendData].reverse().map((day) => (
                  <tr key={day.service_date}>
                    <td>
                      {new Date(
                        `${day.service_date}T12:00:00`
                      ).toLocaleDateString()}
                    </td>
                    <td>{day.breakfast.toLocaleString()}</td>
                    <td>{day.lunch.toLocaleString()}</td>
                    <td>{day.supper.toLocaleString()}</td>
                    <td>
                      <strong>{day.total.toLocaleString()}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MealTrendStat({ label, value }) {
  return (
    <div className="dashboard-card" style={{ padding: "18px 20px" }}>
      <span
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: "800",
          color: "#75818c",
          marginBottom: "6px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          fontSize: "26px",
          lineHeight: 1,
        }}
      >
        {Number(value || 0).toLocaleString()}
      </strong>
    </div>
  );
}

function TrendToggle({ label, active, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? `2px solid ${color}` : "1px solid #d7dee5",
        background: active ? "#ffffff" : "#f4f6f8",
        color: active ? "#25313c" : "#89939d",
        borderRadius: "20px",
        padding: "7px 12px",
        fontSize: "11px",
        fontWeight: "800",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: active ? color : "#aeb7bf",
        }}
      />
      {label}
    </button>
  );
}

export default CommandCenter;
