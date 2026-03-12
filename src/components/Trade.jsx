import { useState, Fragment } from "react";
import "../styles/Trade.css";
import {
  placeOrder, closePosition, getAllUsers,
  getOrdersForUser, getLivePositions, getOrderBookDepth,
  LOT_SIZES, ceilToLot, getNumLots, cancelOrder,
} from "../index.js";

const INSTRUMENTS  = ["Nifty", "BankNifty", "Sensex", "MidNifty"];
const OPTION_TYPES = ["CE", "PE"];

// Shows lot size + preview below the quantity input.
// Pure display — no side effects, no state changes.
function LotHint({ instrument, quantity }) {
  var lotSize = LOT_SIZES[instrument];
  var q = Number(quantity);
  if (!quantity || q <= 0) {
    return <p className="lot-hint">Lot size: <b>{lotSize}</b></p>;
  }
  var ceiled  = ceilToLot(instrument, q);
  var numLots = getNumLots(instrument, ceiled);
  if (ceiled === q) {
    return <p className="lot-hint">Lot size: <b>{lotSize}</b> &nbsp;= <span className="lot-ok">{numLots} lot{numLots !== 1 ? "s" : ""} ✓</span></p>;
  }
  return <p className="lot-hint">Lot size: <b>{lotSize}</b> &nbsp;→ will ceil to <span className="lot-ceil">{ceiled} ({numLots} lots) ↑</span></p>;
}

export default function Trade() {
  const [userId,      setUserId]      = useState(() => getAllUsers()[0]?.id || "");
  const [instrument,  setInstrument]  = useState("Nifty");
  const [strikePrice, setStrikePrice] = useState("");
  const [optionType,  setOptionType]  = useState("CE");
  const [orderType,   setOrderType]   = useState("BUY");
  const [quantity,    setQuantity]    = useState("");
  const [premium,     setPremium]     = useState("");
  const [formMsg,     setFormMsg]     = useState(null);

  const [posToClose,   setPosToClose]   = useState(null);
  const [closePremium, setClosePremium] = useState("");
  const [closeMsg,     setCloseMsg]     = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [cancelMsg,    setCancelMsg]    = useState(null);
  const [tick,         setTick]         = useState(0);

  function bump() { setTick(function(t){ return t + 1; }); }

  // ── Derived data (re-reads on every tick / state change) ──
  var allOrders      = getOrdersForUser(userId);
  var activeOrders   = allOrders.filter(function(o){ return o.status === "PENDING" || o.status === "PARTIAL"; });
  var executedOrders  = allOrders.filter(function(o){ return o.status === "EXECUTED"; });
  var cancelledOrders = allOrders.filter(function(o){ return o.status === "CANCELLED"; });
  var positions      = getLivePositions(userId);

  var hasContract = instrument && strikePrice && optionType;
  var depth = hasContract
    ? getOrderBookDepth(instrument, strikePrice, optionType)
    : { bids: [], asks: [] };
  var maxQty = Math.max(1,
    Math.max.apply(null, depth.bids.map(function(o){ return o.remainingQty; }).concat([0])),
    Math.max.apply(null, depth.asks.map(function(o){ return o.remainingQty; }).concat([0]))
  );

  function fmtTime(iso) {
    return iso ? new Date(iso).toLocaleTimeString("en-IN") : "—";
  }
  function statusClass(s) {
    if (s === "EXECUTED") return "badge badge-accent";
    if (s === "PARTIAL")  return "badge badge-yellow";
    return "badge badge-blue";
  }

  // Ceil quantity when user leaves the field (onBlur)
  function handleQtyBlur() {
    var q = Number(quantity);
    if (q > 0) setQuantity(String(ceilToLot(instrument, q)));
  }

  // ── Place order ──
  function handlePlaceOrder() {
    if (!userId)                                  { setFormMsg({ text: "Select a user.",              err: true }); return; }
    if (!strikePrice || Number(strikePrice) <= 0) { setFormMsg({ text: "Enter a valid strike price.", err: true }); return; }
    if (!quantity    || Number(quantity)    <= 0) { setFormMsg({ text: "Enter quantity.",              err: true }); return; }
    if (!premium     || Number(premium)     <= 0) { setFormMsg({ text: "Enter premium ₹.",            err: true }); return; }

    // Ceil here too, in case user never blurred the field before clicking
    var finalQty = ceilToLot(instrument, Number(quantity));
    setQuantity(String(finalQty));

    var res = placeOrder(userId, instrument, strikePrice, optionType, orderType, finalQty, premium);

    if (res.success) {
      var o    = res.order;
      var note = res.origQty !== res.finalQty ? " [ceiled " + res.origQty + "→" + res.finalQty + "]" : "";
      var msg  = o.orderId + note + " → " + o.status;
      if      (o.status === "EXECUTED") msg += " (" + o.filledQty + " qty filled)";
      else if (o.status === "PARTIAL")  msg += " (" + o.filledQty + " filled, " + o.remainingQty + " pending)";
      else                              msg += " (" + o.quantity + " qty waiting)";
      setFormMsg({ text: msg, err: false });
      setQuantity("");
      setPremium("");
      bump();
    } else {
      setFormMsg({ text: res.message, err: true });
    }
  }

  // ── Close position ──
  function handleClosePos() {
    if (!closePremium || Number(closePremium) <= 0) {
      setCloseMsg({ text: "Enter close price.", err: true }); return;
    }
    var dir = posToClose.netQty > 0 ? "BUY" : "SELL";
    var res = closePosition(userId, posToClose.instrument, posToClose.strikePrice,
                            posToClose.optionType, dir, Math.abs(posToClose.netQty), closePremium);
    if (res.success) {
      var o   = res.order;
      var txt = "Close → " + o.status;
      if      (o.status === "EXECUTED") txt += " (" + o.filledQty + " qty closed)";
      else if (o.status === "PARTIAL")  txt += " (" + o.filledQty + " closed, " + o.remainingQty + " pending)";
      else                              txt += " (waiting for match)";
      setCloseMsg({ text: txt, err: false });
      setPosToClose(null);
      bump();
    } else {
      setCloseMsg({ text: res.message, err: true });
    }
  }

  // ── Cancel an active order ──
  function handleCancel(orderId) {
    var res = cancelOrder(userId, orderId);
    setCancelMsg({ text: res.message, err: !res.success });
    if (res.success) bump();
  }

  return (
    <div className="page">
      <h2 className="page-title">Trading Desk</h2>
      <p className="page-subtitle">Place orders · View order book · Manage positions</p>

      {/* ── ORDER FORM ── */}
      <div className="card">
        <div className="card-title">New Order</div>

        <div className="field">
          <label className="field-label">User</label>
          <select className="select" value={userId}
            onChange={function(e){ setUserId(e.target.value); setPosToClose(null); }}>
            {getAllUsers().map(function(u){
              return <option key={u.id} value={u.id}>{u.id} — {u.name}</option>;
            })}
          </select>
        </div>

        <div className="row-2">
          <div>
            <label className="field-label">Instrument</label>
            <select className="select" value={instrument}
              onChange={function(e){ setInstrument(e.target.value); setQuantity(""); setFormMsg(null); }}>
              {INSTRUMENTS.map(function(i){ return <option key={i}>{i}</option>; })}
            </select>
          </div>
          <div>
            <label className="field-label">Strike Price</label>
            <input className="input" type="number" placeholder="e.g. 24500"
              value={strikePrice}
              onChange={function(e){ setStrikePrice(e.target.value); setFormMsg(null); }} />
            <p className="strike-note">e.g. 24500 · 48000 · 79000</p>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Option Type</label>
          <div className="seg-row">
            {OPTION_TYPES.map(function(t){
              return (
                <button key={t} className={"seg-btn" + (optionType === t ? " active-blue" : "")}
                  onClick={function(){ setOptionType(t); setFormMsg(null); }}>{t}</button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Order Type</label>
          <div className="seg-row">
            <button className={"seg-btn" + (orderType === "BUY"  ? " active-green" : "")} onClick={function(){ setOrderType("BUY");  }}>▲ BUY</button>
            <button className={"seg-btn" + (orderType === "SELL" ? " active-red"   : "")} onClick={function(){ setOrderType("SELL"); }}>▼ SELL</button>
          </div>
        </div>

        <div className="row-2">
          <div>
            <label className="field-label">Quantity</label>
            <input className="input" type="number"
              placeholder={"e.g. " + LOT_SIZES[instrument]}
              value={quantity}
              onChange={function(e){ setQuantity(e.target.value); }}
              onBlur={handleQtyBlur}
            />
            <LotHint instrument={instrument} quantity={quantity} />
          </div>
          <div>
            <label className="field-label">Premium ₹</label>
            <input className="input" type="number" placeholder="e.g. 300"
              value={premium}
              onChange={function(e){ setPremium(e.target.value); }} />
          </div>
        </div>

        <button className={"trade-submit-btn " + (orderType === "BUY" ? "buy" : "sell")}
          onClick={handlePlaceOrder}>
          {orderType === "BUY" ? "▲ Place Buy Order" : "▼ Place Sell Order"}
        </button>

        {formMsg && (
          <div className={"alert " + (formMsg.err ? "alert-error" : "alert-success")}>
            {formMsg.text}
          </div>
        )}
      </div>

      {/* ── ORDER BOOK DEPTH ── */}
      <div className="card">
        <div className="section-heading">
          Order Book Depth
          {hasContract
            ? <span className="ob-contract-label"> — {instrument} {strikePrice} {optionType}</span>
            : <span className="ob-hint"> — enter instrument + strike + type above</span>
          }
        </div>
        <div className="order-book-grid">
          <div className="ob-side">
            <div className="ob-side-title bid">▲ Bids (Buyers)</div>
            <div className="ob-col-header"><span>Price ₹</span><span>Rem Qty</span><span>User</span></div>
            {depth.bids.length === 0 ? <p className="ob-empty">No bids</p> : depth.bids.map(function(o){
              return (
                <div className="ob-row-wrap" key={o.orderId}>
                  <div className="ob-depth-bar bid" style={{ width: Math.round(o.remainingQty / maxQty * 100) + "%" }}></div>
                  <div className="ob-row">
                    <span className="ob-price-bid">₹{o.premium}</span>
                    <span className="ob-qty">{o.remainingQty}{o.status === "PARTIAL" && <span className="ob-partial-tag"> (p)</span>}</span>
                    <span className="ob-user">{o.userId}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ob-side">
            <div className="ob-side-title ask">▼ Asks (Sellers)</div>
            <div className="ob-col-header"><span>Price ₹</span><span>Rem Qty</span><span>User</span></div>
            {depth.asks.length === 0 ? <p className="ob-empty">No asks</p> : depth.asks.map(function(o){
              return (
                <div className="ob-row-wrap" key={o.orderId}>
                  <div className="ob-depth-bar ask" style={{ width: Math.round(o.remainingQty / maxQty * 100) + "%" }}></div>
                  <div className="ob-row">
                    <span className="ob-price-ask">₹{o.premium}</span>
                    <span className="ob-qty">{o.remainingQty}{o.status === "PARTIAL" && <span className="ob-partial-tag"> (p)</span>}</span>
                    <span className="ob-user">{o.userId}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── LIVE POSITIONS ── */}
      <div className="card">
        <div className="section-heading">Live Positions <span className="section-count">{positions.length}</span></div>
        {positions.length === 0 ? <p className="empty-state">No open positions for {userId}.</p> : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th><th>Strike</th><th>Option</th>
                  <th>Direction</th><th>Net Qty</th><th>Avg Buy ₹</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(function(pos, i){
                  var isLong = pos.netQty > 0;
                  return (
                    <tr key={i}>
                      <td><b>{pos.instrument}</b></td>
                      <td className="text-bold">{pos.strikePrice}</td>
                      <td><span className="badge badge-blue">{pos.optionType}</span></td>
                      <td><span className={"badge " + (isLong ? "badge-green" : "badge-red")}>{isLong ? "LONG" : "SHORT"}</span></td>
                      <td className={isLong ? "position-qty-long" : "position-qty-short"}>{Math.abs(pos.netQty)}</td>
                      <td className="text-bold">₹{pos.avgBuyPrice || "—"}</td>
                      <td><button className="btn btn-outline-warn" onClick={function(){ setPosToClose(pos); setClosePremium(""); setCloseMsg(null); }}>Close</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {posToClose && (
              <div className="close-panel">
                <p className="close-panel-title">
                  Closing: <b>{posToClose.instrument} {posToClose.strikePrice} {posToClose.optionType}</b>
                  &nbsp;({posToClose.netQty > 0 ? "LONG" : "SHORT"} {Math.abs(posToClose.netQty)} qty
                  = {getNumLots(posToClose.instrument, Math.abs(posToClose.netQty))} lots)
                </p>
                <div className="close-panel-row">
                  <input className="input close-price-input" type="number" placeholder="Close at ₹..."
                    value={closePremium} onChange={function(e){ setClosePremium(e.target.value); }} />
                  <button className="btn btn-warn" onClick={handleClosePos}>Confirm Close</button>
                  <button className="btn btn-outline-muted" onClick={function(){ setPosToClose(null); }}>Cancel</button>
                </div>
                {closeMsg && <div className={"alert " + (closeMsg.err ? "alert-error" : "alert-success")}>{closeMsg.text}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── ACTIVE ORDERS ── */}
      <div className="card">
        <div className="section-heading">Active Orders <span className="section-count">{activeOrders.length}</span></div>
        {activeOrders.length === 0 ? <p className="empty-state">No active orders for {userId}.</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Instrument</th><th>Strike</th><th>Opt</th>
                <th>Side</th><th>Qty</th><th>Lots</th><th>Filled</th><th>Remaining</th>
                <th>Premium ₹</th><th>Status</th><th>Placed</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map(function(o){
                return (
                  <tr key={o.orderId}>
                    <td className="id-cell">{o.orderId}</td>
                    <td>{o.instrument}</td>
                    <td className="text-bold">{o.strikePrice}</td>
                    <td><span className="badge badge-blue">{o.optionType}</span></td>
                    <td><span className={"badge " + (o.orderType === "BUY" ? "badge-green" : "badge-red")}>{o.orderType}</span></td>
                    <td>{o.quantity}</td>
                    <td className="muted-cell">{getNumLots(o.instrument, o.quantity)}L</td>
                    <td className="text-buy">{o.filledQty}</td>
                    <td className="text-warn">{o.remainingQty}</td>
                    <td className="text-bold">₹{o.premium}</td>
                    <td><span className={statusClass(o.status)}>{o.status}</span></td>
                    <td className="muted-cell">{fmtTime(o.placedAt)}</td>
                    <td>
                      <button className="btn btn-outline-red" onClick={function(){ handleCancel(o.orderId); }}>Cancel</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {cancelMsg && (
          <div className={"alert " + (cancelMsg.err ? "alert-error" : "alert-success")} style={{marginTop:"0.75rem"}}>
            {cancelMsg.text}
          </div>
        )}
      </div>

      {/* ── EXECUTED ORDERS ── */}
      <div className="card">
        <div className="section-heading">Executed Orders <span className="section-count">{executedOrders.length}</span></div>
        <p className="fill-hint">Click a row to see fill details</p>
        {executedOrders.length === 0 ? <p className="empty-state">No executed orders for {userId}.</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Instrument</th><th>Strike</th><th>Opt</th>
                <th>Side</th><th>Qty</th><th>Lots</th><th>Fills</th><th>Exec ₹</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {executedOrders.map(function(o){
                var expanded = expandedId === o.orderId;
                // Use Fragment with key — required when returning multiple rows from map
                return (
                  <Fragment key={o.orderId}>
                    <tr className="exec-row" style={{ cursor: "pointer" }}
                      onClick={function(){ setExpandedId(expanded ? null : o.orderId); }}>
                      <td className="id-cell">{o.orderId}</td>
                      <td>{o.instrument}</td>
                      <td className="text-bold">{o.strikePrice}</td>
                      <td><span className="badge badge-blue">{o.optionType}</span></td>
                      <td><span className={"badge " + (o.orderType === "BUY" ? "badge-green" : "badge-red")}>{o.orderType}</span></td>
                      <td>{o.quantity}</td>
                      <td className="muted-cell">{getNumLots(o.instrument, o.quantity)}L</td>
                      <td className="text-accent">{o.fills.length} fill{o.fills.length !== 1 ? "s" : ""}</td>
                      <td className="exec-price-cell">₹{o.executionPrice}</td>
                      <td className="muted-cell">{fmtTime(o.executedAt)}</td>
                    </tr>
                    {expanded && o.fills.map(function(fill){
                      return (
                        <tr key={fill.fillId} className="fill-detail-row">
                          <td colSpan="10">
                            <div className="fill-detail">
                              <span className="fill-id">{fill.fillId}</span>
                              <span>Qty: <b>{fill.filledQty}</b></span>
                              <span>Price: <b className="text-accent">₹{fill.executionPrice}</b></span>
                              <span>Buyer: <b>{fill.buyUserId}</b></span>
                              <span>Seller: <b>{fill.sellUserId}</b></span>
                              <span className="muted-cell">{fmtTime(fill.filledAt)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CANCELLED ORDERS ── */}
      <div className="card">
        <div className="section-heading">Cancelled Orders <span className="section-count">{cancelledOrders.length}</span></div>
        {cancelledOrders.length === 0 ? <p className="empty-state">No cancelled orders for {userId}.</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Instrument</th><th>Strike</th><th>Opt</th>
                <th>Side</th><th>Orig Qty</th><th>Filled</th><th>Premium ₹</th><th>Placed</th><th>Cancelled At</th>
              </tr>
            </thead>
            <tbody>
              {cancelledOrders.map(function(o){
                return (
                  <tr key={o.orderId} className="cancelled-row">
                    <td className="id-cell">{o.orderId}</td>
                    <td>{o.instrument}</td>
                    <td className="text-bold">{o.strikePrice}</td>
                    <td><span className="badge badge-blue">{o.optionType}</span></td>
                    <td><span className={"badge " + (o.orderType === "BUY" ? "badge-green" : "badge-red")}>{o.orderType}</span></td>
                    <td className="muted-cell">{o.quantity}</td>
                    <td className="text-buy">{o.filledQty}</td>
                    <td className="text-bold">₹{o.premium}</td>
                    <td className="muted-cell">{fmtTime(o.placedAt)}</td>
                    <td className="muted-cell">{fmtTime(o.cancelledAt)}</td>
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