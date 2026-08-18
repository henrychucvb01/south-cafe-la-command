import React, { useState } from "react";

import LoginPage from "./pages/LoginPage";
import EmployeeSelectPage from "./pages/EmployeeSelectPage";
import SchoolHub from "./pages/SchoolHub";
import FinishLinePage from "./pages/FinishLinePage";
import SchoolDashboard from "./pages/SchoolDashboard";
import CommandCenter from "./pages/CommandCenter";
import SupervisorPinPage from "./pages/SupervisorPinPage";

function App() {
  const [screen, setScreen] = useState("login");

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Holds today's existing Finish Line when the manager is editing it.
  // null = creating a new Finish Line.
  const [editingCheck, setEditingCheck] = useState(null);

  function resetToLogin() {
    setSelectedLocation(null);
    setSelectedEmployee(null);
    setEditingCheck(null);
    setScreen("login");
  }

  // LOGIN
  if (screen === "login") {
    return (
      <LoginPage
        onLocationSelected={(location) => {
          setSelectedLocation(location);
          setSelectedEmployee(null);
          setEditingCheck(null);
          setScreen("employeeSelect");
        }}
        onSupervisor={() => {
          setEditingCheck(null);
          setScreen("supervisorPin");
        }}
      />
    );
  }

  // SUPERVISOR PIN
  if (screen === "supervisorPin") {
    return (
      <SupervisorPinPage
        onSuccess={() => {
          setScreen("commandCenter");
        }}
        onBack={() => {
          setScreen("login");
        }}
      />
    );
  }

  // EMPLOYEE SELECTION
  if (screen === "employeeSelect") {
    return (
      <EmployeeSelectPage
        location={selectedLocation}
        onEmployeeSelected={(employee) => {
          setSelectedEmployee(employee);
          setEditingCheck(null);
          setScreen("schoolHub");
        }}
        onBack={() => {
          resetToLogin();
        }}
      />
    );
  }

  // SCHOOL HUB
  if (screen === "schoolHub") {
    return (
      <SchoolHub
        location={selectedLocation}
        employee={selectedEmployee}
        onFinishLine={() => {
          // Starting from the hub means create a new check,
          // unless we later decide to detect today's existing one here.
          setEditingCheck(null);
          setScreen("finishLine");
        }}
        onDashboard={() => {
          setScreen("schoolDashboard");
        }}
        onExit={() => {
          resetToLogin();
        }}
      />
    );
  }

  // FINISH LINE
  if (screen === "finishLine") {
    return (
      <FinishLinePage
        location={selectedLocation}
        employee={selectedEmployee}
        existingCheck={editingCheck}
        onBack={() => {
          // If this is a supervisor preview,
          // go back to the Command Center.
          if (editingCheck?.previewMode) {
            setEditingCheck(null);
            setScreen("commandCenter");
            return;
          }

          // Normal manager flow:
          // go back to the School Dashboard.
          setEditingCheck(null);
          setScreen("schoolDashboard");
        }}
        onComplete={() => {
          setEditingCheck(null);
          setScreen("schoolDashboard");
        }}
      />
    );
  }

  // SCHOOL DASHBOARD
  if (screen === "schoolDashboard") {
    return (
      <SchoolDashboard
        location={selectedLocation}
        employee={selectedEmployee}
        onBack={() => {
          setEditingCheck(null);
          setScreen("schoolHub");
        }}
        onEditFinishLine={(check) => {
          setEditingCheck(check);
          setScreen("finishLine");
        }}
      />
    );
  }

  // SUPERVISOR COMMAND CENTER
  if (screen === "commandCenter") {
    return (
      <CommandCenter
        onExit={() => {
          resetToLogin();
        }}
        onPreviewFinishLine={(preview) => {
          setEditingCheck({
            previewMode: true,
            previewDay: preview.day,
            previewMonthEnd: preview.monthEnd,
          });

          setScreen("finishLine");
        }}
      />
    );
  }

  return null;
}

export default App;
