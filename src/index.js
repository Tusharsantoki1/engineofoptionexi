// ============================================================
//  index.js  —  ALL BACKEND LOGIC
// ============================================================

export let users = [
  { id: "U001", name: "Virat Kohli" },
  { id: "U002", name: "Rohit Sharma"  },
  { id: "U003", name: "Tushar Santoki"    },
];

export let orderBook = [];
var _orderId = 1;
var _userId  = 4;
var _fillId  = 1;

// ── LOT SIZES ──
export var LOT_SIZES = {
  Nifty:     65,
  BankNifty: 30,
  Sensex:    20,
  MidNifty:  120,
};

// Ceil qty to nearest lot multiple
// e.g. Nifty lot=65: 70→130, 65→65, 1→65, 130→130
export function ceilToLot(instrument, quantity) {
  var lotSize = LOT_SIZES[instrument];
  if (!lotSize) return Number(quantity);
  var q = Number(quantity);
  if (!q || q <= 0) return lotSize;
  return Math.ceil(q / lotSize) * lotSize;
}

export function getNumLots(instrument, quantity) {
  var lotSize = LOT_SIZES[instrument];
  if (!lotSize || !quantity) return 0;
  return Math.floor(Number(quantity) / lotSize);
}

// ── HELPERS ──
function _ordId() { return "ORD-" + String(_orderId++).padStart(4,"0"); }
function _filId() { return "FIL-" + String(_fillId++).padStart(4,"0"); }
function _now()   { return new Date().toISOString(); }

// ── MATCHING ENGINE ──
// Fills new order against all price-matching resting orders.
// BUY incoming: match SELLs sorted low→high price
// SELL incoming: match BUYs sorted high→low price
function matchOrder(newOrder) {
  var otherSide = newOrder.orderType === "BUY" ? "SELL" : "BUY";

  var candidates = orderBook.filter(function(o) {
    return (
      (o.status === "PENDING" || o.status === "PARTIAL") &&
      o.remainingQty > 0 &&
      o.orderType   === otherSide &&
      o.instrument  === newOrder.instrument &&
      o.strikePrice === newOrder.strikePrice &&
      o.optionType  === newOrder.optionType &&
      o.userId      !== newOrder.userId
    );
  });

  if (newOrder.orderType === "BUY") {
    candidates.sort(function(a,b){ return a.premium - b.premium; });
  } else {
    candidates.sort(function(a,b){ return b.premium - a.premium; });
  }

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (newOrder.remainingQty === 0) break;

    var priceOk = newOrder.orderType === "BUY"
      ? newOrder.premium >= c.premium
      : newOrder.premium <= c.premium;
    if (!priceOk) break;

    var qty   = Math.min(newOrder.remainingQty, c.remainingQty);
    var price = c.premium;

    var fill = {
      fillId:         _filId(),
      buyOrderId:     newOrder.orderType === "BUY" ? newOrder.orderId : c.orderId,
      sellOrderId:    newOrder.orderType === "SELL" ? newOrder.orderId : c.orderId,
      buyUserId:      newOrder.orderType === "BUY" ? newOrder.userId : c.userId,
      sellUserId:     newOrder.orderType === "SELL" ? newOrder.userId : c.userId,
      instrument:     newOrder.instrument,
      strikePrice:    newOrder.strikePrice,
      optionType:     newOrder.optionType,
      filledQty:      qty,
      executionPrice: price,
      filledAt:       _now(),
    };

    newOrder.fills.push(fill);
    c.fills.push(fill);

    newOrder.remainingQty -= qty;
    c.remainingQty        -= qty;
    newOrder.filledQty    += qty;
    c.filledQty           += qty;

    if (c.remainingQty === 0) {
      c.status         = "EXECUTED";
      c.executedAt     = _now();
      c.executionPrice = price;
    } else {
      c.status = "PARTIAL";
    }
  }

  if (newOrder.remainingQty === 0) {
    newOrder.status         = "EXECUTED";
    newOrder.executedAt     = _now();
    newOrder.executionPrice = newOrder.fills[newOrder.fills.length - 1].executionPrice;
  } else if (newOrder.filledQty > 0) {
    newOrder.status = "PARTIAL";
  } else {
    newOrder.status = "PENDING";
  }
}

// ── PLACE ORDER ──
export function placeOrder(userId, instrument, strikePrice, optionType, orderType, quantity, premium) {
  var origQty  = Number(quantity);
  var finalQty = ceilToLot(instrument, origQty);

  var oppType = orderType === "BUY" ? "SELL" : "BUY";
  var conflict = orderBook.find(function(o) {
    return (
      o.userId      === userId &&
      o.instrument  === instrument &&
      o.strikePrice === Number(strikePrice) &&
      o.optionType  === optionType &&
      o.orderType   === oppType &&
      (o.status === "PENDING" || o.status === "PARTIAL")
    );
  });

  if (conflict) {
    return {
      success: false,
      message: "You already have a pending " + conflict.orderType +
               " order for " + instrument + " " + strikePrice + " " + optionType + ".",
    };
  }

  var order = {
    orderId:        _ordId(),
    userId:         userId,
    instrument:     instrument,
    strikePrice:    Number(strikePrice),
    optionType:     optionType,
    orderType:      orderType,
    quantity:       finalQty,
    remainingQty:   finalQty,
    filledQty:      0,
    premium:        Number(premium),
    status:         "PENDING",
    placedAt:       _now(),
    executedAt:     null,
    executionPrice: null,
    fills:          [],
  };

  matchOrder(order);
  orderBook.push(order);
  return { success: true, order: order, origQty: origQty, finalQty: finalQty };
}

// ── CLOSE POSITION ──
export function closePosition(userId, instrument, strikePrice, optionType, direction, quantity, premium) {
  var rev = direction === "BUY" ? "SELL" : "BUY";
  return placeOrder(userId, instrument, strikePrice, optionType, rev, quantity, premium);
}

export function getOrdersForUser(userId) {
  return orderBook.filter(function(o){ return o.userId === userId; });
}

export function getOrderBookDepth(instrument, strikePrice, optionType) {
  var active = orderBook.filter(function(o) {
    return (
      (o.status === "PENDING" || o.status === "PARTIAL") &&
      o.remainingQty > 0 &&
      o.instrument  === instrument &&
      o.strikePrice === Number(strikePrice) &&
      o.optionType  === optionType
    );
  });
  var bids = active.filter(function(o){ return o.orderType === "BUY"; })
                   .sort(function(a,b){ return b.premium - a.premium; });
  var asks = active.filter(function(o){ return o.orderType === "SELL"; })
                   .sort(function(a,b){ return a.premium - b.premium; });
  return { bids: bids, asks: asks };
}

export function getLivePositions(userId) {
  var map = {};
  orderBook.forEach(function(order) {
    if (order.userId !== userId || order.fills.length === 0) return;
    order.fills.forEach(function(fill) {
      var key = fill.instrument + "-" + fill.strikePrice + "-" + fill.optionType;
      if (!map[key]) {
        map[key] = { instrument: fill.instrument, strikePrice: fill.strikePrice,
                     optionType: fill.optionType, netQty: 0,
                     totalBuyCost: 0, totalBuyQty: 0, avgBuyPrice: 0 };
      }
      if (order.orderType === "BUY") {
        map[key].netQty       += fill.filledQty;
        map[key].totalBuyCost += fill.filledQty * fill.executionPrice;
        map[key].totalBuyQty  += fill.filledQty;
      } else {
        map[key].netQty -= fill.filledQty;
      }
    });
  });
  Object.values(map).forEach(function(p) {
    if (p.totalBuyQty > 0)
      p.avgBuyPrice = Math.round((p.totalBuyCost / p.totalBuyQty) * 100) / 100;
  });
  return Object.values(map).filter(function(p){ return p.netQty !== 0; });
}

export function addUser(name) {
  var u = { id: "U" + String(_userId++).padStart(3,"0"), name: name.trim() };
  users.push(u);
  return u;
}
export function deleteUser(userId) {
  var i = users.findIndex(function(u){ return u.id === userId; });
  if (i !== -1) users.splice(i, 1);
}
export function getAllUsers() {
  return users.slice();
}