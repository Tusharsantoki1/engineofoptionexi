// ============================================================
//  App.jsx  —  Root Component
//  Only two tabs: Admin and Trade (Dashboard is inside Trade)
// ============================================================

import { useState } from "react";
import "./styles/global.css";
import "./styles/App.css";

import Admin from "./components/Admin.jsx";
import Trade from "./components/Trade.jsx";

function App() {
  const [activeTab, setActiveTab] = useState("trade");

  return (
    <div className="app-wrapper">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-logo">⬡ OptionsDeskPro</div>

        <nav className="app-nav">
          {[
            { key: "admin", label: "Admin" },
            { key: "trade", label: "Trade" },
          ].map(function (tab) {
            return (
              <button
                key={tab.key}
                className={"nav-tab" + (activeTab === tab.key ? " active" : "")}
                onClick={function () { setActiveTab(tab.key); }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Content ── */}
      <main className="app-main">
        {activeTab === "admin" && <Admin />}
        {activeTab === "trade" && <Trade />}
      </main>

    </div>
  );
}

export default App;