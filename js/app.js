/* ============================================================
 * 电商订单进销存一体化工作台 - 界面与交互
 * ============================================================ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = ERP;

  /* ---------------- 通用工具 ---------------- */
  function toast(msg, type) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, 2800);
  }
  function toCSV(headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach(r => {
      lines.push(r.map(c => {
        let s = String(c == null ? '' : c);
        if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(','));
    });
    return '﻿' + lines.join('\r\n');
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 120);
  }
  function dateDiffDays(a, b) { // a,b: 'YYYY-MM-DD'
    const da = new Date(a + 'T00:00:00'); const db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }
  function monthOf(dateStr) { return dateStr.slice(0, 7); }
  function statusBadge(s) {
    const map = {
      '正常待发货': 'badge pending', '已发货完成': 'badge shipped',
      '已退货入库': 'badge returned', '退换处理中': 'badge processing', '作废订单': 'badge void'
    };
    return `<span class="${map[s] || 'badge'}">${E.esc(s)}</span>`;
  }

  /* ============================================================
   * 商品档案
   * ============================================================ */
  function renderProducts() {
    const list = E.getProducts();
    const rows = list.map(p => {
      const profit = E.round2(p.price - p.cost);
      const low = p.currentStock < p.safety;
      return `<tr class="${low ? 'row-warn' : ''}">
        <td>${E.esc(p.createDate)}</td>
        <td>${E.esc(p.name)}</td>
        <td>${E.esc(p.model)}</td>
        <td>${E.esc(p.spec)}</td>
        <td class="num">${profit >= 0 ? p.cost.toFixed(2) : p.cost.toFixed(2)}</td>
        <td class="num">${p.price.toFixed(2)}</td>
        <td class="num profit">${profit.toFixed(2)}</td>
        <td class="num">${p.currentStock}</td>
        <td class="num">${p.initStock}</td>
        <td class="num">${p.safety}</td>
        <td>${low ? '<span class="badge warn">⚠ 库存预警</span>' : '<span class="badge ok">正常</span>'}</td>
        <td class="ops">
          <button class="btn sm" data-act="prod-edit" data-id="${p.id}">编辑</button>
          <button class="btn sm danger" data-act="prod-del" data-id="${p.id}">删除</button>
        </td>
      </tr>`;
    }).join('');
    const warnCount = list.filter(p => p.currentStock < p.safety).length;
    $('prodTableContainer').innerHTML = `
      <div class="stat-line">共 ${list.length} 个商品${warnCount ? `，<b class="danger">${warnCount} 个低于安全库存</b>` : '，库存均正常'}。</div>
      <div class="table-wrap">
      <table class="grid">
        <thead><tr>
          <th>建档日期</th><th>产品名称</th><th>产品型号</th><th>尺寸规格</th>
          <th>成本价</th><th>售价</th><th>单件利润</th><th>当前库存</th>
          <th>初始库存</th><th>安全库存</th><th>预警状态</th><th>操作</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="12" class="empty">暂无商品，点击右上角“新增商品”建档</td></tr>'}</tbody>
      </table></div>`;
    if (warnCount) toast(`有 ${warnCount} 个商品库存低于安全阈值，已标红预警`, 'warn');
  }

  function openProdForm(id) {
    const p = id ? E.getProductById(id) : null;
    const today = E.nowStr();
    const f = $('prodFormWrap');
    f.classList.remove('hidden');
    f.innerHTML = `
      <form id="prodForm" class="form">
        <div class="form-row">
          <label>建档日期<input type="date" name="createDate" value="${p ? p.createDate : today}" required></label>
          <label>产品名称*<input type="text" name="name" value="${p ? E.esc(p.name) : ''}" placeholder="唯一，作为订单匹配关键字" required></label>
          <label>产品型号<input type="text" name="model" value="${p ? E.esc(p.model) : ''}" placeholder="区分同名称不同规格"></label>
          <label>尺寸规格<input type="text" name="spec" value="${p ? E.esc(p.spec) : ''}" placeholder="长宽高等参数"></label>
        </div>
        <div class="form-row">
          <label>成本价(元)<input type="number" step="0.01" min="0" name="cost" value="${p ? p.cost : ''}" required></label>
          <label>售价(元)<input type="number" step="0.01" min="0" name="price" value="${p ? p.price : ''}" required></label>
          <label>单件利润(自动)<input type="text" name="profit" class="readonly" value="${p ? E.round2(p.price - p.cost).toFixed(2) : ''}" readonly></label>
          <label>${id ? '初始库存(建账)' : '初始库存*'}<input type="number" step="1" min="0" name="initStock" value="${p ? p.initStock : ''}" ${id ? 'readonly class="readonly"' : 'required'}></label>
          <label>安全库存阈值<input type="number" step="1" min="0" name="safety" value="${p ? p.safety : '0'}" required></label>
        </div>
        ${id ? `<div class="form-tip">当前库存：${p.currentStock}（仅由订单发货/退货自动变动，不可手动修改）</div>` : ''}
        <div class="form-actions">
          <button type="submit" class="btn primary">保存</button>
          <button type="button" class="btn" id="prodCancel">取消</button>
        </div>
      </form>`;
    const form = $('prodForm');
    const upd = () => {
      const c = parseFloat(form.cost.value), pr = parseFloat(form.price.value);
      form.profit.value = (isNaN(c) || isNaN(pr)) ? '' : E.round2(pr - c).toFixed(2);
    };
    form.cost.addEventListener('input', upd);
    form.price.addEventListener('input', upd);
    $('prodCancel').onclick = () => f.classList.add('hidden');
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = {
        createDate: form.createDate.value, name: form.name.value, model: form.model.value,
        spec: form.spec.value, cost: form.cost.value, price: form.price.value,
        initStock: form.initStock.value, safety: form.safety.value
      };
      const r = id ? E.updateProduct(id, d) : E.addProduct(d);
      if (!r.ok) { toast(r.msg, 'warn'); return; }
      toast(id ? '商品已更新' : '商品已建档', 'ok');
      f.classList.add('hidden');
      renderProducts(); refreshPrintSelect();
    };
    form.name.focus();
  }

  /* ============================================================
   * 订单录入
   * ============================================================ */
  let orderView = 'detail'; // detail | merge

  function productOptions(selected) {
    const ps = E.getProducts();
    let html = '<option value="">-- 选择产品 --</option>';
    ps.forEach(p => { html += `<option value="${E.esc(p.name)}" ${selected === p.name ? 'selected' : ''}>${E.esc(p.name)}</option>`; });
    if (selected && !ps.some(p => p.name === selected)) html += `<option value="${E.esc(selected)}" selected>${E.esc(selected)}（已删除）</option>`;
    return html;
  }
  function expressOptions() {
    const ex = (E.getMeta().express || E.DEFAULT_EXPRESS).slice();
    return ex.map(x => `<option value="${E.esc(x)}">`).join('');
  }

  function renderOrders() {
    const list = E.getOrders();
    if (orderView === 'merge') return renderOrdersMerge(list);
    const rows = list.map(o => `
      <tr>
        <td>${E.esc(o.orderNo)}</td>
        <td>${E.esc(o.platform)}</td>
        <td>${E.esc(o.express)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${E.esc(o.productName)}</td>
        <td>${E.esc(o.model)}</td>
        <td class="num">${o.qty}</td>
        <td class="num profit">${o.lineProfit.toFixed(2)}</td>
        <td class="num">${o.orderTotal.toFixed(2)}</td>
        <td>${E.esc(o.orderDate)}</td>
        <td>${E.esc(o.shipDate) || '-'}</td>
        <td class="note" title="${E.esc(o.note)}">${E.esc(o.note) || '-'}</td>
        <td class="ops">
          <button class="btn sm" data-act="ord-edit" data-id="${o.id}">编辑</button>
          ${o.status !== E.STATUS.SHIPPED ? `<button class="btn sm ok" data-act="ord-ship" data-id="${o.id}">发货</button>` : ''}
          ${o.status !== E.STATUS.RETURNED ? `<button class="btn sm" data-act="ord-return" data-id="${o.id}">退货</button>` : ''}
          ${o.status !== E.STATUS.VOID ? `<button class="btn sm" data-act="ord-void" data-id="${o.id}">作废</button>` : ''}
          <button class="btn sm" data-act="ord-print" data-id="${o.id}">打印</button>
          <button class="btn sm danger" data-act="ord-del" data-id="${o.id}">删除</button>
        </td>
      </tr>`).join('');
    $('orderTableContainer').innerHTML = `
      <div class="table-wrap"><table class="grid">
        <thead><tr>
          <th>订单编号</th><th>平台</th><th>快递</th><th>状态</th><th>产品</th><th>型号</th>
          <th>数量</th><th>单品总利润</th><th>订单总金额</th><th>下单日期</th><th>发货日期</th><th>备注</th><th>操作</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="13" class="empty">暂无订单，点击右上角“新增订单”</td></tr>'}</tbody>
      </table></div>`;
  }

  function renderOrdersMerge(list) {
    const map = {};
    list.forEach(o => { (map[o.orderNo] = map[o.orderNo] || []).push(o); });
    const nos = Object.keys(map).sort((a, b) => (map[b][0].orderDate || '').localeCompare(map[a][0].orderDate || ''));
    const rows = nos.map(no => {
      const lines = map[no];
      const totalQty = lines.reduce((s, o) => s + o.qty, 0);
      const totalAmt = lines.reduce((s, o) => s + o.orderTotal, 0);
      const totalProfit = lines.reduce((s, o) => s + o.lineProfit, 0);
      const detail = lines.map(l => `${E.esc(l.productName)}×${l.qty}`).join('，');
      return `<tr>
        <td>${E.esc(no)}</td>
        <td>${E.esc(lines[0].platform)}</td>
        <td>${statusBadge(lines[0].status)}</td>
        <td class="note" title="${E.esc(detail)}">${E.esc(detail)}</td>
        <td class="num">${totalQty}</td>
        <td class="num">${totalAmt.toFixed(2)}</td>
        <td class="num profit">${totalProfit.toFixed(2)}</td>
        <td>${E.esc(lines[0].orderDate)}</td>
        <td class="ops">
          <button class="btn sm" data-act="ord-print-no" data-no="${E.esc(no)}">打印</button>
        </td>
      </tr>`;
    }).join('');
    $('orderTableContainer').innerHTML = `
      <div class="stat-line">合并视图：共 ${nos.length} 笔订单（按订单编号聚合，多品合并单已合并统计）。</div>
      <div class="table-wrap"><table class="grid">
        <thead><tr>
          <th>订单编号</th><th>平台</th><th>状态</th><th>产品明细</th>
          <th>总数量</th><th>总金额</th><th>总利润</th><th>下单日期</th><th>操作</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="9" class="empty">暂无订单</td></tr>'}</tbody>
      </table></div>`;
  }

  function openOrderForm(id) {
    const o = id ? E.getOrderById(id) : null;
    const today = E.nowStr();
    const f = $('orderFormWrap');
    f.classList.remove('hidden');
    const platformOpts = E.PLATFORMS.map(p => `<option value="${p}" ${o && o.platform === p ? 'selected' : ''}>${p}</option>`).join('');
    const statusOpts = E.STATUS_LIST.map(s => `<option value="${s}" ${o && o.status === s ? 'selected' : ''}>${s}</option>`).join('');
    f.innerHTML = `
      <form id="orderForm" class="form">
        <div class="form-row">
          <label>订单编号*<span class="inline"><input type="text" name="orderNo" value="${o ? E.esc(o.orderNo) : ''}" placeholder="可留空自动生成" required>
            <button type="button" class="btn sm" id="genNo">自动生成</button></span></label>
          <label>平台来源*<select name="platform">${platformOpts}</select></label>
          <label>发货快递<datalist id="expList">${expressOptions()}</datalist><input type="text" name="express" list="expList" value="${o ? E.esc(o.express) : ''}" placeholder="可手动补充"></label>
          <label>退换处理状态*<select name="status">${statusOpts}</select></label>
        </div>
        <div class="form-row">
          <label>产品名称*<select name="productName" id="ordProd">${productOptions(o ? o.productName : '')}</select></label>
          <label>型号<input type="text" name="model" id="ordModel" class="readonly" value="${o ? E.esc(o.model) : ''}" readonly></label>
          <label>尺寸规格<input type="text" name="spec" id="ordSpec" class="readonly" value="${o ? E.esc(o.spec) : ''}" readonly></label>
          <label>成本价<input type="text" name="cost" id="ordCost" class="readonly" value="${o ? o.cost.toFixed(2) : ''}" readonly></label>
          <label>售价<input type="text" name="price" id="ordPrice" class="readonly" value="${o ? o.price.toFixed(2) : ''}" readonly></label>
          <label>单件利润<input type="text" name="profit" id="ordProfit" class="readonly" value="${o ? o.profit.toFixed(2) : ''}" readonly></label>
        </div>
        <div class="form-row">
          <label>下单数量*<input type="number" step="1" min="1" name="qty" id="ordQty" value="${o ? o.qty : ''}" required></label>
          <label>单品总利润<input type="text" name="lineProfit" id="ordLine" class="readonly" value="${o ? o.lineProfit.toFixed(2) : ''}" readonly></label>
          <label>订单总金额<input type="text" name="orderTotal" id="ordTotal" class="readonly" value="${o ? o.orderTotal.toFixed(2) : ''}" readonly></label>
          <label>下单日期<input type="date" name="orderDate" value="${o ? o.orderDate : today}" required></label>
          <label>发货日期<input type="date" name="shipDate" id="ordShip" value="${o ? o.shipDate : ''}"></label>
        </div>
        <label class="full">备注<textarea name="note" rows="2" placeholder="收件人/客户信息、特殊要求等">${o ? E.esc(o.note) : ''}</textarea></label>
        <div class="form-actions">
          <button type="submit" class="btn primary">保存</button>
          <button type="button" class="btn" id="ordCancel">取消</button>
        </div>
      </form>`;
    const form = $('orderForm');
    const fillSnap = () => {
      const name = form.productName.value;
      const p = E.getProductByName(name);
      if (p) {
        form.model.value = p.model; form.spec.value = p.spec;
        form.cost.value = p.cost.toFixed(2); form.price.value = p.price.toFixed(2);
        form.profit.value = E.round2(p.price - p.cost).toFixed(2);
      } else { form.model.value = form.spec.value = form.cost.value = form.price.value = form.profit.value = ''; }
      calc();
    };
    const calc = () => {
      const price = parseFloat(form.price.value), profit = parseFloat(form.profit.value), qty = parseInt(form.qty.value, 10);
      form.lineProfit.value = (isNaN(profit) || isNaN(qty)) ? '' : E.round2(profit * qty).toFixed(2);
      form.orderTotal.value = (isNaN(price) || isNaN(qty)) ? '' : E.round2(price * qty).toFixed(2);
    };
    form.productName.onchange = fillSnap;
    form.qty.oninput = calc;
    form.status.onchange = () => { form.shipDate.disabled = (form.status.value !== E.STATUS.SHIPPED); };
    form.status.onchange();
    $('genNo').onclick = () => { form.orderNo.value = E.genOrderNo(); };
    $('ordCancel').onclick = () => f.classList.add('hidden');
    if (!o) fillSnap();
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = {
        orderNo: form.orderNo.value.trim() || E.genOrderNo(),
        platform: form.platform.value, express: form.express.value, status: form.status.value,
        productName: form.productName.value, qty: form.qty.value,
        orderDate: form.orderDate.value, shipDate: form.shipDate.value, note: form.note.value
      };
      const r = id ? E.updateOrder(id, d) : E.addOrder(d);
      if (!r.ok) { toast(r.msg, 'warn'); return; }
      toast(id ? '订单已更新' : '订单已录入', 'ok');
      f.classList.add('hidden');
      renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect();
    };
    form.orderNo.focus();
  }

  /* ============================================================
   * 库存台账
   * ============================================================ */
  function renderInventory() {
    const onlyLow = $('invOnlyLow') && $('invOnlyLow').checked;
    let list = E.getProducts();
    if (onlyLow) list = list.filter(p => p.currentStock < p.safety);
    const rows = list.map(p => {
      const profit = E.round2(p.price - p.cost);
      const low = p.currentStock < p.safety;
      return `<tr class="${low ? 'row-warn' : ''}">
        <td>${E.esc(p.name)}</td>
        <td>${E.esc(p.model)}</td>
        <td class="num">${p.currentStock}</td>
        <td class="num">${p.safety}</td>
        <td>${low ? '<span class="badge warn">⚠ 库存不足</span>' : '<span class="badge ok">充足</span>'}</td>
        <td class="num">${p.initStock}</td>
        <td class="num profit">${profit.toFixed(2)}</td>
        <td>${E.esc(p.createDate)}</td>
      </tr>`;
    }).join('');
    $('invTableContainer').innerHTML = `
      <div class="table-wrap"><table class="grid">
        <thead><tr>
          <th>产品名称</th><th>型号</th><th>当前库存</th><th>安全库存</th><th>预警状态</th>
          <th>初始库存</th><th>单件利润</th><th>建档日期</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="empty">无匹配商品</td></tr>'}</tbody>
      </table></div>`;
  }

  /* ============================================================
   * 统计看板
   * ============================================================ */
  function dashFilter() {
    const period = $('dashPeriod').value;
    const platform = $('dashPlatform').value;
    const year = parseInt($('dashYear').value, 10) || new Date().getFullYear();
    const month = $('dashMonth').value; // YYYY-MM
    const today = E.nowStr();
    return function (o) {
      if (platform !== '全部' && o.platform !== platform) return false;
      const d = o.orderDate;
      let ok = true;
      switch (period) {
        case 'today': ok = d === today; break;
        case '7d': ok = dateDiffDays(d, today) >= 0 && dateDiffDays(d, today) <= 6; break;
        case '30d': ok = dateDiffDays(d, today) >= 0 && dateDiffDays(d, today) <= 29; break;
        case 'month': ok = monthOf(d) === monthOf(today); break;
        case 'half1': ok = d.slice(0, 4) === String(year) && parseInt(d.slice(5, 7), 10) <= 6; break;
        case 'half2': ok = d.slice(0, 4) === String(year) && parseInt(d.slice(5, 7), 10) >= 7; break;
        case 'year': ok = d.slice(0, 4) === String(year); break;
        case 'customMonth': ok = monthOf(d) === month; break;
      }
      return ok;
    };
  }

  function barList(title, items, unit) {
    if (!items.length) return `<div class="chart-block"><h4>${title}</h4><div class="empty small">无数据</div></div>`;
    const max = Math.max.apply(null, items.map(i => i.value));
    const rows = items.map(i => {
      const pct = max > 0 ? Math.round(i.value / max * 100) : 0;
      return `<div class="bar-row"><span class="bar-label" title="${E.esc(i.label)}">${E.esc(i.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="bar-val">${i.display != null ? i.display : i.value}${unit || ''}</span></div>`;
    }).join('');
    return `<div class="chart-block"><h4>${title}</h4>${rows}</div>`;
  }

  function renderDashboard() {
    const period = $('dashPeriod').value;
    $('dashYear').style.display = (period === 'half1' || period === 'half2' || period === 'year') ? '' : 'none';
    $('dashMonth').style.display = (period === 'customMonth') ? '' : 'none';

    const all = E.getOrders();
    const filt = dashFilter();
    const valid = all.filter(o => filt(o) && [E.STATUS.PENDING, E.STATUS.SHIPPED, E.STATUS.PROCESSING].indexOf(o.status) >= 0);

    const orderNos = new Set(valid.map(o => o.orderNo));
    const totalAmt = valid.reduce((s, o) => s + o.orderTotal, 0);
    const totalProfit = valid.reduce((s, o) => s + o.lineProfit, 0);
    const totalQty = valid.reduce((s, o) => s + o.qty, 0);

    // 平台占比
    const platMap = {};
    valid.forEach(o => { platMap[o.platform] = platMap[o.platform] || { count: 0, amt: 0 }; platMap[o.platform].count++; platMap[o.platform].amt += o.orderTotal; });
    const platItems = Object.keys(platMap).map(k => ({ label: k, value: platMap[k].amt, display: '¥' + platMap[k].amt.toFixed(0) + ' / ' + platMap[k].count + '单' })).sort((a, b) => b.value - a.value);

    // 销量排行
    const prodMap = {};
    valid.forEach(o => { prodMap[o.productName] = (prodMap[o.productName] || 0) + o.qty; });
    const rankItems = Object.keys(prodMap).map(k => ({ label: k, value: prodMap[k] })).sort((a, b) => b.value - a.value).slice(0, 10);

    // 月度营收（年/半年视图）
    let monthChart = '';
    if (period === 'year' || period === 'half1' || period === 'half2') {
      const year = parseInt($('dashYear').value, 10) || new Date().getFullYear();
      const months = (period === 'half1') ? [1, 2, 3, 4, 5, 6] : (period === 'half2') ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const mItems = months.map(m => {
        const key = String(year) + '-' + String(m).padStart(2, '0');
        const amt = valid.filter(o => monthOf(o.orderDate) === key).reduce((s, o) => s + o.orderTotal, 0);
        return { label: m + '月', value: amt, display: '¥' + amt.toFixed(0) };
      });
      monthChart = barList('月度营收趋势', mItems, '');
    }

    const periodLabel = { today: '今日', '7d': '近7天', '30d': '近30天', month: '本月', half1: '上半年', half2: '下半年', year: '全年', customMonth: '指定月份' }[period];

    $('dashContainer').innerHTML = `
      <div class="dash-head">统计周期：<b>${periodLabel}</b> ｜ 有效订单（不含已退货/作废）：<b>${orderNos.size}</b> 笔，明细 <b>${valid.length}</b> 行</div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-val">${orderNos.size}</div><div class="kpi-label">订单总量(笔)</div></div>
        <div class="kpi"><div class="kpi-val">¥${totalAmt.toFixed(2)}</div><div class="kpi-label">销售总金额</div></div>
        <div class="kpi"><div class="kpi-val profit">¥${totalProfit.toFixed(2)}</div><div class="kpi-label">总利润</div></div>
        <div class="kpi"><div class="kpi-val">${totalQty}</div><div class="kpi-label">销售总件数</div></div>
      </div>
      <div class="chart-row">
        ${barList('各平台销售额占比', platItems, '')}
        ${barList('产品销量排行(Top10)', rankItems, ' 件')}
      </div>
      ${monthChart}
      <div class="table-wrap"><table class="grid">
        <thead><tr><th>平台</th><th>订单数</th><th>销售额</th><th>利润</th></tr></thead>
        <tbody>${platItems.length ? platItems.map(i => {
          const p = valid.filter(o => o.platform === i.label);
          const amt = p.reduce((s, o) => s + o.orderTotal, 0);
          const pf = p.reduce((s, o) => s + o.lineProfit, 0);
          const cnt = new Set(p.map(o => o.orderNo)).size;
          return `<tr><td>${E.esc(i.label)}</td><td class="num">${cnt}</td><td class="num">${amt.toFixed(2)}</td><td class="num profit">${pf.toFixed(2)}</td></tr>`;
        }).join('') : '<tr><td colspan="4" class="empty">无数据</td></tr>'}</tbody>
      </table></div>`;
  }

  /* ============================================================
   * 操作日志
   * ============================================================ */
  function renderLogs() {
    const type = $('logTypeFilter') ? $('logTypeFilter').value : '全部';
    let list = E.getLogs().slice().reverse();
    if (type !== '全部') list = list.filter(l => l.type === type);
    const types = ['全部'].concat(Array.from(new Set(E.getLogs().map(l => l.type))));
    $('logTypeFilter').innerHTML = types.map(t => `<option value="${t}" ${t === type ? 'selected' : ''}>${t}</option>`).join('');
    const rows = list.map(l => `<tr>
      <td>${E.esc(l.time)}</td>
      <td>${E.esc(l.operator)}</td>
      <td><span class="badge logtype">${E.esc(l.type)}</span></td>
      <td class="note" title="${E.esc(l.before)}">${E.esc(l.before) || '-'}</td>
      <td class="note" title="${E.esc(l.after)}">${E.esc(l.after) || '-'}</td>
    </tr>`).join('');
    $('logTableContainer').innerHTML = `
      <div class="stat-line">共 ${list.length} 条操作记录（永久保存，不可删除、不可篡改）。</div>
      <div class="table-wrap"><table class="grid">
        <thead><tr><th>操作时间</th><th>操作人</th><th>操作类型</th><th>修改前</th><th>修改后</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">暂无操作记录</td></tr>'}</tbody>
      </table></div>`;
  }

  /* ============================================================
   * 发货单打印
   * ============================================================ */
  function refreshPrintSelect() {
    const sel = $('printOrderSelect');
    if (!sel) return;
    const nos = Array.from(new Set(E.getOrders().map(o => o.orderNo)));
    sel.innerHTML = nos.length ? nos.map(n => `<option value="${E.esc(n)}">${E.esc(n)}</option>`).join('') : '<option value="">（暂无订单）</option>';
    if (nos.length) renderPrintPreview(nos[0]);
  }
  function renderSlip(orderNo) {
    const lines = E.getOrders().filter(o => o.orderNo === orderNo);
    if (!lines.length) return '<div class="empty">未找到该订单</div>';
    const meta = E.getMeta();
    const o = lines[0];
    const totalQty = lines.reduce((s, x) => s + x.qty, 0);
    const totalAmt = lines.reduce((s, x) => s + x.orderTotal, 0);
    const rows = lines.map(l => `<tr><td>${E.esc(l.productName)}</td><td>${E.esc(l.model)}</td><td>${E.esc(l.spec)}</td><td class="num">${l.qty}</td><td class="num">${l.price.toFixed(2)}</td><td class="num">${l.orderTotal.toFixed(2)}</td></tr>`).join('');
    return `
      <div class="slip">
        <div class="slip-head">
          <div class="slip-shop">${E.esc(meta.shopName || '我的店铺')}</div>
          <div class="slip-title">发货单 / 拣货单</div>
        </div>
        <div class="slip-meta">
          <div><b>订单编号：</b>${E.esc(orderNo)}</div>
          <div><b>平台来源：</b>${E.esc(o.platform)}</div>
          <div><b>发货快递：</b>${E.esc(o.express) || '—'}</div>
          <div><b>下单日期：</b>${E.esc(o.orderDate)}</div>
          <div><b>发货日期：</b>${E.esc(o.shipDate) || '—'}</div>
          <div><b>当前状态：</b>${E.esc(o.status)}</div>
        </div>
        <div class="slip-addr"><b>收件/客户信息：</b>${E.esc(o.note) || '（请在备注填写收件人、地址、电话等）'}</div>
        <table class="slip-table">
          <thead><tr><th>产品名称</th><th>型号</th><th>尺寸</th><th>数量</th><th>单价</th><th>小计</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3" class="num"><b>合计</b></td><td class="num"><b>${totalQty}</b></td><td></td><td class="num"><b>¥${totalAmt.toFixed(2)}</b></td></tr></tfoot>
        </table>
        <div class="slip-foot">打印时间：${E.nowDateTime()} ｜ 操作人：${E.esc(meta.operator || '管理员')}</div>
      </div>`;
  }
  function renderPrintPreview(orderNo) {
    const html = renderSlip(orderNo);
    const prev = $('printPreview'); if (prev) prev.innerHTML = html;
    const area = $('printArea'); if (area) area.innerHTML = html;
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  function exportProducts() {
    const hs = ['建档日期', '产品名称', '产品型号', '尺寸规格', '成本价', '售价', '单件利润', '当前库存', '初始库存', '安全库存阈值', '预警状态'];
    const rows = E.getProducts().map(p => [p.createDate, p.name, p.model, p.spec, p.cost, p.price, E.round2(p.price - p.cost), p.currentStock, p.initStock, p.safety, p.currentStock < p.safety ? '库存预警' : '正常']);
    download('商品档案表.csv', toCSV(hs, rows));
    E.recordExport('商品档案表');
  }
  function exportOrders() {
    const hs = ['订单编号', '平台来源', '发货快递', '退换处理状态', '产品名称', '型号', '尺寸', '成本价', '售价', '单件利润', '下单数量', '单品总利润', '订单总金额', '下单日期', '发货日期', '备注'];
    const rows = E.getOrders().map(o => [o.orderNo, o.platform, o.express, o.status, o.productName, o.model, o.spec, o.cost, o.price, o.profit, o.qty, o.lineProfit, o.orderTotal, o.orderDate, o.shipDate, o.note]);
    download('订单明细表.csv', toCSV(hs, rows));
    E.recordExport('订单明细表');
  }
  function exportInventory() {
    const hs = ['产品名称', '型号', '当前库存', '安全库存阈值', '预警状态', '初始库存', '单件利润', '建档日期'];
    const rows = E.getProducts().map(p => [p.name, p.model, p.currentStock, p.safety, p.currentStock < p.safety ? '库存预警' : '正常', p.initStock, E.round2(p.price - p.cost), p.createDate]);
    download('库存台账.csv', toCSV(hs, rows));
    E.recordExport('库存台账');
  }
  function exportLogs() {
    const hs = ['操作时间', '操作人', '操作类型', '修改前', '修改后'];
    const rows = E.getLogs().map(l => [l.time, l.operator, l.type, l.before, l.after]);
    download('操作日志.csv', toCSV(hs, rows));
    E.recordExport('操作日志');
  }
  function exportDash() {
    const period = $('dashPeriod').value;
    const filt = dashFilter();
    const valid = E.getOrders().filter(o => filt(o) && [E.STATUS.PENDING, E.STATUS.SHIPPED, E.STATUS.PROCESSING].indexOf(o.status) >= 0);
    const orderNos = new Set(valid.map(o => o.orderNo));
    const totalAmt = valid.reduce((s, o) => s + o.orderTotal, 0);
    const totalProfit = valid.reduce((s, o) => s + o.lineProfit, 0);
    const hs = ['统计维度', '指标', '数值'];
    const rows = [
      ['汇总', '订单总量(笔)', orderNos.size],
      ['汇总', '销售总金额', totalAmt.toFixed(2)],
      ['汇总', '总利润', totalProfit.toFixed(2)],
      ['汇总', '销售总件数', valid.reduce((s, o) => s + o.qty, 0)]
    ];
    const platMap = {};
    valid.forEach(o => { platMap[o.platform] = platMap[o.platform] || { cnt: 0, amt: 0 }; platMap[o.platform].cnt++; platMap[o.platform].amt += o.orderTotal; });
    Object.keys(platMap).forEach(k => rows.push(['平台占比', k, '订单' + platMap[k].cnt + '笔 / 销售额' + platMap[k].amt.toFixed(2)]));
    const prodMap = {};
    valid.forEach(o => { prodMap[o.productName] = (prodMap[o.productName] || 0) + o.qty; });
    Object.keys(prodMap).forEach(k => rows.push(['销量排行', k, prodMap[k] + '件']));
    download('统计报表_' + period + '.csv', toCSV(hs, rows));
    E.recordExport('统计报表');
  }

  /* ============================================================
   * 事件绑定 / 初始化
   * ============================================================ */
  function bindEvents() {
    // 顶部操作人
    const op = $('operatorInput');
    op.value = E.getMeta().operator || '管理员';
    op.onchange = () => { E.setMeta({ operator: op.value.trim() || '管理员' }); toast('操作人已更新', 'ok'); renderLogs(); };

    // 备份 / 恢复
    $('backupBtn').onclick = () => {
      const data = JSON.stringify(E.backupData());
      download('进销存数据备份_' + E.nowStr() + '.json', data, 'application/json');
      toast('数据已备份导出', 'ok');
    };
    $('restoreBtn').onclick = () => $('restoreFile').click();
    $('restoreFile').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          const r = E.restoreData(obj);
          if (!r.ok) { toast(r.msg, 'warn'); return; }
          toast('数据已恢复', 'ok');
          renderAll();
        } catch (err) { toast('恢复失败：文件解析错误', 'warn'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    // Tab 切换
    document.querySelectorAll('.tab').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        $('page-' + b.dataset.page).classList.add('active');
        if (b.dataset.page === 'dashboard') renderDashboard();
        if (b.dataset.page === 'print') refreshPrintSelect();
        if (b.dataset.page === 'logs') renderLogs();
      };
    });

    // 商品页
    $('prodAddBtn').onclick = () => openProdForm();
    $('prodExportBtn').onclick = exportProducts;
    $('prodTableContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'prod-edit') openProdForm(id);
      if (btn.dataset.act === 'prod-del') {
        const p = E.getProductById(id);
        if (confirm(`确认删除商品「${p.name}」？`)) {
          const r = E.deleteProduct(id);
          if (!r.ok) toast(r.msg, 'warn'); else { toast('已删除', 'ok'); renderProducts(); refreshPrintSelect(); }
        }
      }
    });

    // 订单页
    $('orderAddBtn').onclick = () => openOrderForm();
    $('orderExportBtn').onclick = exportOrders;
    document.querySelectorAll('[data-view]').forEach(b => {
      b.onclick = () => {
        orderView = b.dataset.view;
        document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderOrders();
      };
    });
    $('orderTableContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const id = btn.dataset.id; const o = E.getOrderById(id);
      if (btn.dataset.act === 'ord-edit') openOrderForm(id);
      if (btn.dataset.act === 'ord-ship') {
        if (confirm(`确认将订单「${o.orderNo}」标记为【已发货完成】？系统将扣减库存 ${o.qty} 件。`)) {
          const r = E.changeStatus(id, E.STATUS.SHIPPED);
          if (!r.ok) toast(r.msg, 'warn'); else { toast('已发货，库存已扣减', 'ok'); renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect(); }
        }
      }
      if (btn.dataset.act === 'ord-return') {
        if (confirm(`确认将订单「${o.orderNo}」标记为【已退货入库】？系统将回库 ${o.qty} 件。`)) {
          const r = E.changeStatus(id, E.STATUS.RETURNED);
          if (!r.ok) toast(r.msg, 'warn'); else { toast('已退货，库存已回库', 'ok'); renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect(); }
        }
      }
      if (btn.dataset.act === 'ord-void') {
        if (confirm(`确认将订单「${o.orderNo}」标记为【作废订单】？`)) {
          const r = E.changeStatus(id, E.STATUS.VOID);
          if (!r.ok) toast(r.msg, 'warn'); else { toast('订单已作废', 'ok'); renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect(); }
        }
      }
      if (btn.dataset.act === 'ord-print') { renderSlip(o.orderNo); $('printArea').innerHTML = renderSlip(o.orderNo); window.print(); }
      if (btn.dataset.act === 'ord-del') {
        if (confirm(`确认删除订单「${o.orderNo}」？删除将回滚该订单对库存的影响。`)) {
          const r = E.deleteOrder(id);
          if (!r.ok) toast(r.msg, 'warn'); else { toast('订单已删除', 'ok'); renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect(); }
        }
      }
      if (btn.dataset.act === 'ord-print-no') { $('printArea').innerHTML = renderSlip(btn.dataset.no); window.print(); }
    });

    // 库存页
    $('invOnlyLow').onchange = renderInventory;
    $('invExportBtn').onclick = exportInventory;

    // 看板页
    $('dashPeriod').onchange = renderDashboard;
    $('dashYear').onchange = renderDashboard;
    $('dashMonth').onchange = renderDashboard;
    $('dashPlatform').onchange = renderDashboard;
    $('dashRefresh').onclick = () => { renderDashboard(); toast('统计已刷新', 'ok'); };
    $('dashExportBtn').onclick = exportDash;

    // 日志页
    $('logTypeFilter').onchange = renderLogs;
    $('logExportBtn').onclick = exportLogs;

    // 打印页
    $('printOrderSelect').onchange = (e) => renderPrintPreview(e.target.value);
    $('printShopName').value = E.getMeta().shopName || '我的店铺';
    $('printShopName').onchange = () => { E.setMeta({ shopName: $('printShopName').value.trim() || '我的店铺' }); renderPrintPreview($('printOrderSelect').value); };
    $('printDoBtn').onclick = () => { $('printArea').innerHTML = renderSlip($('printOrderSelect').value); window.print(); };
  }

  function renderAll() {
    renderProducts(); renderOrders(); renderInventory(); renderDashboard(); renderLogs(); refreshPrintSelect();
  }

  function init() {
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
