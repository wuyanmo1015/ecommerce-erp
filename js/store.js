/* ============================================================
 * 电商订单进销存一体化工作台 - 数据层 / 业务逻辑
 * 纯前端 + localStorage，可直接用浏览器打开使用
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 常量定义 ---------- */
  const KEYS = {
    products: 'erp_products_v1',
    orders: 'erp_orders_v1',
    logs: 'erp_logs_v1',
    meta: 'erp_meta_v1'
  };

  const STATUS = {
    PENDING: '正常待发货',
    SHIPPED: '已发货完成',
    RETURNED: '已退货入库',
    PROCESSING: '退换处理中',
    VOID: '作废订单'
  };
  const STATUS_LIST = [STATUS.PENDING, STATUS.SHIPPED, STATUS.RETURNED, STATUS.PROCESSING, STATUS.VOID];

  const PLATFORMS = ['1688', '天猫', '淘宝', '京东', '抖音', '拼多多'];
  const DEFAULT_EXPRESS = ['顺丰速运', '中通快递', '圆通速递', '申通快递', '韵达快递', '京东物流', '邮政EMS', '德邦快递', '极兔速递'];

  /* ---------- 工具函数 ---------- */
  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function nowStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function nowDateTime() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function genId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function genOrderNo() {
    const d = new Date();
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `DD${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${rand}`;
  }

  /* ---------- 持久化 ---------- */
  function load(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  let products = load(KEYS.products, []);
  let orders = load(KEYS.orders, []);
  let logs = load(KEYS.logs, []);
  let meta = load(KEYS.meta, { operator: '管理员', shopName: '我的店铺', express: DEFAULT_EXPRESS.slice() });

  function persistProducts() { save(KEYS.products, products); }
  function persistOrders() { save(KEYS.orders, orders); }
  function persistLogs() { save(KEYS.logs, logs); }
  function persistMeta() { save(KEYS.meta, meta); }

  /* ---------- 操作日志 ---------- */
  function addLog(type, before, after) {
    logs.push({
      id: genId('L'),
      ts: Date.now(),
      time: nowDateTime(),
      operator: (meta.operator || '管理员'),
      type: type,
      before: before || '',
      after: after || ''
    });
    persistLogs();
  }

  /* ============================================================
   * 商品档案
   * ============================================================ */
  function getProducts() { return products.slice(); }
  function getProductByName(name) { return products.find(p => p.name === name); }
  function getProductById(id) { return products.find(p => p.id === id); }

  function validateProduct(data, excludeId) {
    if (!data.name || !String(data.name).trim()) return '产品名称不能为空';
    const nm = String(data.name).trim();
    if (products.some(p => p.name === nm && p.id !== excludeId)) return '产品名称已存在，不能重复';
    if (isNaN(data.cost) || Number(data.cost) < 0) return '成本价必须为不小于0的数字';
    if (isNaN(data.price) || Number(data.price) < 0) return '售价必须为不小于0的数字';
    if (isNaN(data.initStock) || Number(data.initStock) < 0 || !Number.isInteger(Number(data.initStock))) return '初始库存必须为不小于0的整数';
    if (isNaN(data.safety) || Number(data.safety) < 0 || !Number.isInteger(Number(data.safety))) return '安全库存阈值必须为不小于0的整数';
    return null;
  }

  function addProduct(data) {
    const err = validateProduct(data, null);
    if (err) return { ok: false, msg: err };
    const nm = String(data.name).trim();
    const prod = {
      id: genId('P'),
      createDate: data.createDate || nowStr(),
      name: nm,
      model: (data.model || '').trim(),
      spec: (data.spec || '').trim(),
      cost: round2(data.cost),
      price: round2(data.price),
      initStock: Math.round(Number(data.initStock)),
      currentStock: Math.round(Number(data.initStock)),
      safety: Math.round(Number(data.safety))
    };
    products.push(prod);
    persistProducts();
    addLog('新增商品', '', `名称:${nm} | 型号:${prod.model} | 成本价:${prod.cost} | 售价:${prod.price} | 初始库存:${prod.initStock} | 安全库存:${prod.safety}`);
    return { ok: true, product: prod };
  }

  function updateProduct(id, data) {
    const p = products.find(x => x.id === id);
    if (!p) return { ok: false, msg: '商品不存在' };
    const err = validateProduct(data, id);
    if (err) return { ok: false, msg: err };
    const before = JSON.stringify(p);
    p.createDate = data.createDate || p.createDate;
    p.name = String(data.name).trim();
    p.model = (data.model || '').trim();
    p.spec = (data.spec || '').trim();
    p.cost = round2(data.cost);
    p.price = round2(data.price);
    p.initStock = Math.round(Number(data.initStock));
    // currentStock 仅由订单流转改变，编辑商品时不手动改
    p.safety = Math.round(Number(data.safety));
    persistProducts();
    addLog('修改商品信息', before, JSON.stringify(p));
    return { ok: true, product: p };
  }

  function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return { ok: false, msg: '商品不存在' };
    const linked = orders.filter(o => o.productName === p.name).length;
    if (linked > 0) return { ok: false, msg: `该商品已被 ${linked} 条订单引用，无法直接删除。请先处理相关订单（作废/删除）。` };
    const before = JSON.stringify(p);
    products = products.filter(x => x.id !== id);
    persistProducts();
    addLog('删除商品', before, '');
    return { ok: true };
  }

  /* ============================================================
   * 库存联动（发货扣减 / 退货回库）
   * ============================================================ */
  // 应用状态转移带来的库存变化（依据“旧状态→新状态”的净影响）
  // 规则：
  //   已发货完成            → 扣减（仅当此前非已发货）
  //   已退货入库            → 回库（仅当该订单此前确已发货）
  //   正常待发货 / 退换处理中 / 作废订单 → 库存不变动
  function applyStockTransition(productName, oldStatus, newStatus, qty) {
    const p = getProductByName(productName);
    if (!p) return { ok: false, msg: '商品不存在，无法调整库存' };
    let delta = 0;
    if (newStatus === STATUS.SHIPPED && oldStatus !== STATUS.SHIPPED) {
      delta = -qty; // 发货扣减
    } else if (newStatus === STATUS.RETURNED && oldStatus === STATUS.SHIPPED) {
      delta = +qty; // 退货回库（仅当曾发货，避免从未发货订单凭空加库存）
    }
    // 正常待发货 / 退换处理中 / 作废订单 → delta 保持 0，库存不变动
    if (delta < 0 && p.currentStock < qty) {
      return { ok: false, msg: `库存不足，禁止发货：当前库存 ${p.currentStock} < 发货数量 ${qty}` };
    }
    p.currentStock += delta;
    persistProducts();
    return { ok: true, delta };
  }

  function snapshotProduct(name) {
    const p = getProductByName(name);
    if (!p) return null;
    return {
      model: p.model, spec: p.spec, cost: p.cost, price: p.price,
      profit: round2(p.price - p.cost)
    };
  }

  /* ============================================================
   * 订单明细
   * ============================================================ */
  function getOrders() { return orders.slice(); }
  function getOrderById(id) { return orders.find(o => o.id === id); }
  function getLogs() { return logs.slice(); }
  function orderNoExists(no, excludeId) { return orders.some(o => o.id !== excludeId && o.orderNo === no); }

  function validateOrder(data, excludeId) {
    if (!data.orderNo || !String(data.orderNo).trim()) return '订单编号不能为空';
    if (orderNoExists(String(data.orderNo).trim(), excludeId)) return '订单编号已存在，不能重复';
    if (PLATFORMS.indexOf(data.platform) < 0) return '请选择有效的平台来源';
    if (!data.productName) return '请选择产品';
    if (!getProductByName(data.productName)) return '所选产品不存在，可能已被删除';
    if (isNaN(data.qty) || Number(data.qty) <= 0 || !Number.isInteger(Number(data.qty))) return '下单数量必须为正整数';
    if (STATUS_LIST.indexOf(data.status) < 0) return '无效的退换处理状态';
    return null;
  }

  function buildOrderObj(data, id) {
    const no = String(data.orderNo).trim();
    const snap = snapshotProduct(data.productName);
    const qty = Math.round(Number(data.qty));
    const shipDate = (data.status === STATUS.SHIPPED) ? (data.shipDate || nowStr()) : (data.shipDate || '');
    return {
      id: id || genId('O'),
      orderNo: no,
      platform: data.platform,
      express: (data.express || '').trim(),
      status: data.status,
      productName: data.productName,
      model: snap.model, spec: snap.spec, cost: snap.cost, price: snap.price, profit: snap.profit,
      qty: qty,
      lineProfit: round2(snap.profit * qty),
      orderTotal: round2(snap.price * qty),
      orderDate: data.orderDate || nowStr(),
      shipDate: shipDate,
      note: (data.note || '').trim()
    };
  }

  function addOrder(data) {
    const err = validateOrder(data, null);
    if (err) return { ok: false, msg: err };
    // 新建即按状态结算库存（直接建为已发货则扣减）
    const stockBefore = (getProductByName(data.productName) || {}).currentStock;
    const tr = applyStockTransition(data.productName, null, data.status, Math.round(Number(data.qty)));
    if (!tr.ok) return { ok: false, msg: tr.msg };
    const order = buildOrderObj(data);
    orders.push(order);
    persistOrders();
    const stockAfter = (getProductByName(data.productName) || {}).currentStock;
    const extra = tr.delta ? ` | 库存变动:${tr.delta}（变动前:${stockBefore}，变动后:${stockAfter}）` : '';
    addLog('新增订单', '', `订单号:${order.orderNo} | 产品:${order.productName} | 数量:${order.qty} | 状态:${order.status}` + extra);
    return { ok: true, order: order };
  }

  function updateOrder(id, data) {
    const o = getOrderById(id);
    if (!o) return { ok: false, msg: '订单不存在' };
    const err = validateOrder(data, id);
    if (err) return { ok: false, msg: err };
    const before = JSON.stringify(o);
    const newName = data.productName;
    const stockBefore = (getProductByName(newName) || {}).currentStock;
    // 1) 若旧订单曾发货，先回滚（恢复）旧产品库存；产品是否变更都需处理旧产品
    if (o.status === STATUS.SHIPPED) {
      const op = getProductByName(o.productName);
      if (op) { op.currentStock += o.qty; persistProducts(); }
    }
    // 2) 结算新产品库存（该订单在新产品上的历史影响已在第 1 步归零，故 oldStatus 视为 null）
    const tr = applyStockTransition(newName, null, data.status, Math.round(Number(data.qty)));
    if (!tr.ok) {
      // 回滚第 1 步
      if (o.status === STATUS.SHIPPED) {
        const op = getProductByName(o.productName);
        if (op) { op.currentStock -= o.qty; persistProducts(); }
      }
      return { ok: false, msg: tr.msg };
    }
    const order = buildOrderObj(data, id);
    const idx = orders.findIndex(x => x.id === id);
    orders[idx] = order;
    persistOrders();
    const stockAfter = (getProductByName(newName) || {}).currentStock;
    let extra = tr.delta ? ` | 库存变动:${tr.delta}（变动前:${stockBefore}，变动后:${stockAfter}）` : '';
    if (o.productName !== newName && o.status === STATUS.SHIPPED) extra += ` | 旧产品${o.productName}回库:${o.qty}`;
    addLog('修改订单', before, JSON.stringify(order) + extra);
    return { ok: true, order: order };
  }

  function changeStatus(id, newStatus) {
    const o = getOrderById(id);
    if (!o) return { ok: false, msg: '订单不存在' };
    if (STATUS_LIST.indexOf(newStatus) < 0) return { ok: false, msg: '无效状态' };
    if (o.status === newStatus) return { ok: true, msg: '状态未变化', order: o };
    const before = JSON.stringify(o);
    const p = getProductByName(o.productName);
    const stockBefore = p ? p.currentStock : null;
    // 依据“旧状态→新状态”的净影响调整库存（无需单独回滚旧状态）
    const tr = applyStockTransition(o.productName, o.status, newStatus, o.qty);
    if (!tr.ok) return { ok: false, msg: tr.msg };
    o.status = newStatus;
    if (newStatus === STATUS.SHIPPED && !o.shipDate) o.shipDate = nowStr();
    persistOrders();
    const stockAfter = getProductByName(o.productName).currentStock;
    const extra = tr.delta ? ` | 库存变动:${tr.delta}（变动前:${stockBefore}，变动后:${stockAfter}）` : '';
    addLog('状态变更', before, JSON.stringify(o) + extra);
    return { ok: true, order: o, delta: tr.delta };
  }

  function deleteOrder(id) {
    const o = getOrderById(id);
    if (!o) return { ok: false, msg: '订单不存在' };
    const before = JSON.stringify(o);
    const p = getProductByName(o.productName);
    const stockBefore = p ? p.currentStock : null;
    let extra = '';
    // 仅当该订单此前确已发货（占用过库存）才回库；待发货/退货/退换/作废状态本就不占库存，无需变动
    if (o.status === STATUS.SHIPPED && p) {
      p.currentStock += o.qty;
      persistProducts();
      extra = ` | 库存回库:${o.qty}（变动前:${stockBefore}，变动后:${p.currentStock}）`;
    }
    orders = orders.filter(x => x.id !== id);
    persistOrders();
    addLog('删除订单', before, '' + extra);
    return { ok: true };
  }

  /* ============================================================
   * 元信息 / 备份恢复
   * ============================================================ */
  function getMeta() { return Object.assign({}, meta); }
  // 记录“数据导出”到操作日志（保持内存与持久化一致）
  function recordExport(name) { addLog('数据导出', '', name || '数据导出'); return { ok: true }; }
  function setMeta(patch) {
    Object.assign(meta, patch);
    persistMeta();
    return meta;
  }

  function backupData() {
    return {
      _type: 'ecommerce_erp_backup',
      _version: 1,
      _exportedAt: nowDateTime(),
      products: products, orders: orders, logs: logs, meta: meta
    };
  }
  function restoreData(obj) {
    if (!obj || obj._type !== 'ecommerce_erp_backup') return { ok: false, msg: '备份文件格式不正确' };
    products = obj.products || [];
    orders = obj.orders || [];
    logs = obj.logs || [];
    meta = obj.meta || { operator: '管理员', shopName: '我的店铺', express: DEFAULT_EXPRESS.slice() };
    persistProducts(); persistOrders(); persistLogs(); persistMeta();
    return { ok: true };
  }

  /* ---------- 对外暴露 ---------- */
  global.ERP = {
    STATUS, STATUS_LIST, PLATFORMS, DEFAULT_EXPRESS,
    round2, esc, nowStr, nowDateTime, genOrderNo,
    getProducts, getProductByName, getProductById,
    addProduct, updateProduct, deleteProduct,
    getOrders, getOrderById, addOrder, updateOrder, changeStatus, deleteOrder,
    getLogs, getMeta, setMeta, recordExport,
    backupData, restoreData
  };
})(window);
