// ============================================================
//  Dashboard.jsx  —  User Dashboard Component
//  Shows: Live Positions, Pending Orders, Executed Orders.
//  Styles come from: global.css + Dashboard.css
// ============================================================

import { useState } from "react";
import "../styles/Dashboard.css";                       // Dashboard-specific styles
import {
  getAllUsers,
  getOrdersForUser,
  getLivePositions,
  closePosition,
} from "../index.js";

function Dashboard({ refreshKey }) {
  const [selectedUser, setSelectedUser] = useState(getAllUsers()[0]?.id || "");
  const [posToClose,   setPosToClose]   = useState(null);   // position being closed
  const [closePremium, setClosePremium] = useState("");
  const [closeMsg,     setCloseMsg]     = useState(null);   // { text, isError }

  // Read data from index.js for the selected user
  const allOrders  = getOrdersForUser(selectedUser);
  const pending    = allOrders.filter(function (o) { return o.status === "PENDING";  });
  const executed   = allOrders.filter(function (o) { return o.status === "EXECUTED"; });
  const positions  = getLivePositions(selectedUser);

  function fmtTime(iso) {
    return iso ? new Date(iso).toLocaleTimeString("en-IN") : "—";
  }

  // ── Handle Close Position submit ──
  function handleClosePosition() {
    if (!closePremium || Number(closePremium) <= 0) {
      setCloseMsg({ text: "Enter a valid price to close at.", isError: true });
      return;
    }

    // If user is LONG (net qty > 0) they must SELL to close
    // If user is SHORT (net qty < 0) they must BUY to close
    const currentDir = posToClose.netQty > 0 ? "BUY" : "SELL";

    const result = closePosition(
      selectedUser,
      posToClose.instrument,
      posToClose.optionType,
      currentDir,
      Math.abs(posToClose.netQty),
      closePremium
    );

    if (result.success) {
      const o = result.order;
      let text = "Close order placed → " + o.status;
      if (o.status === "EXECUTED") text += " at ₹" + o.executionPrice;
      else text += " (pending match at ₹" + closePremium + ")";
      setCloseMsg({ text, isError: false });
      setPosToClose(null); // hide the panel
    } else {
      setCloseMsg({ text: result.message, isError: true });
    }
  }

  return (
    <div className="page">
      <h2 className="page-title">User Dashboard</h2>
      <p className="page-subtitle">View positions, pending orders, and trade history</p>

      {/* ── User Selector ── */}
      <div className="card">
        <div className="card-title">Select User</div>
        <select
          className={"select dashboard-user-select"}
          value={selectedUser}
          onChange={function (e) {
            setSelectedUser(e.target.value);
            setPosToClose(null);
            setCloseMsg(null);
          }}
        >
          {getAllUsers().map(function (u) {
            return (
              <option key={u.id} value={u.id}>{u.id} — {u.name}</option>
            );
          })}
        </select>
      </div>

      {/* ══════════════════════════════════
          SECTION 1 — LIVE POSITIONS
      ══════════════════════════════════ */}
      <div className="card">
        <div className="card-title">
          Live Positions
          <span className="section-count">{positions.length}</span>
        </div>

        {positions.length === 0 ? (
          <p className="empty-state">No open positions for this user.</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Option</th>
                  <th>Direction</th>
                  <th>Net Qty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(function (pos, i) {
                  const isLong = pos.netQty > 0;
                  return (
                    <tr key={i}>
                      <td><b>{pos.instrument}</b></td>
                      <td><span className="badge badge-blue">{pos.optionType}</span></td>
                      <td>
                        <span className={"badge " + (isLong ? "badge-green" : "badge-red")}>
                          {isLong ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className={isLong ? "position-qty-long" : "position-qty-short"}>
                        {Math.abs(pos.netQty)}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-warn"
                          onClick={function () {
                            setPosToClose(pos);
                            setClosePremium("");
                            setCloseMsg(null);
                          }}
                        >
                          Close Position
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Close Position Panel (shows when user clicks Close) ── */}
            {posToClose && (
              <div className="close-panel">
                <p className="close-panel-title">
                  Closing: <b>{posToClose.instrument} {posToClose.optionType}</b>
                  &nbsp;({posToClose.netQty > 0 ? "LONG" : "SHORT"} {Math.abs(posToClose.netQty)} qty)
                </p>
                <p className="close-panel-note">
                  Enter the price to close at. Order executes when a counterparty matches this price.
                </p>

                <div className="close-panel-row">
                  <input
                    className={"input close-price-input"}
                    type="number"
                    placeholder="Close at ₹..."
                    value={closePremium}
                    onChange={function (e) { setClosePremium(e.target.value); }}
                  />
                  <button className="btn btn-warn" onClick={handleClosePosition}>
                    Confirm Close
                  </button>
                  <button
                    className="btn btn-outline-muted"
                    onClick={function () { setPosToClose(null); }}
                  >
                    Cancel
                  </button>
                </div>

                {closeMsg && (
                  <div className={"alert " + (closeMsg.isError ? "alert-error" : "alert-success")}>
                    {closeMsg.text}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════
          SECTION 2 — PENDING ORDERS
      ══════════════════════════════════ */}
      <div className="card">
        <div className="card-title">
          Pending Orders
          <span className="section-count">{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <p className="empty-state">No pending orders for this user.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Instrument</th>
                <th>Option</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Asked ₹</th>
                <th>Placed At</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(function (o) {
                return (
                  <tr key={o.orderId}>
                    <td className="text-accent">{o.orderId}</td>
                    <td>{o.instrument}</td>
                    <td><span className="badge badge-blue">{o.optionType}</span></td>
                    <td>
                      <span className={"badge " + (o.orderType === "BUY" ? "badge-green" : "badge-red")}>
                        {o.orderType}
                      </span>
                    </td>
                    <td>{o.quantity}</td>
                    <td className="text-bold">₹{o.premium}</td>
                    <td className="muted-cell">{fmtTime(o.placedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════════════════════════════════
          SECTION 3 — EXECUTED ORDERS
      ══════════════════════════════════ */}
      <div className="card">
        <div className="card-title">
          Executed Orders — History
          <span className="section-count">{executed.length}</span>
        </div>

        {executed.length === 0 ? (
          <p className="empty-state">No executed orders yet for this user.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Instrument</th>
                <th>Option</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Exec Price ₹</th>
                <th>Matched With</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {executed.map(function (o) {
                return (
                  <tr key={o.orderId}>
                    <td className="text-accent">{o.orderId}</td>
                    <td>{o.instrument}</td>
                    <td><span className="badge badge-blue">{o.optionType}</span></td>
                    <td>
                      <span className={"badge " + (o.orderType === "BUY" ? "badge-green" : "badge-red")}>
                        {o.orderType}
                      </span>
                    </td>
                    <td>{o.quantity}</td>
                    <td className="exec-price-cell">₹{o.executionPrice}</td>
                    <td className="muted-cell">{o.matchedWith}</td>
                    <td className="muted-cell">{fmtTime(o.executedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;