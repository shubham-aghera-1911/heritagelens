
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import Explorer from "./pages/Explorer.jsx";
import Archive from "./pages/Archive.jsx";
import Viewer3D from "./pages/Viewer3D.jsx";
import MonumentDetails from "./pages/MonumentDetails";

// Admin pages
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/explore" element={<Explorer />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/viewer3d" element={<Viewer3D />} />
        <Route path="/monument/:id" element={<MonumentDetails />} />

        {/* ADMIN ROUTES */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
