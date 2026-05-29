// ═══════════════════════════════════════════════
//  CATÁLOGO DE PRODUCTOS
// ═══════════════════════════════════════════════
const CATALOGO = {
  'remera-recta':    { nombre: 'Remera recta 20.1',       precioBase: 22000, ajusteNino: -2000, ajusteEspecial: 2000,  tieneColores: true,  tieneTalles: true  },
  'remera-oversize': { nombre: 'Remera oversize 20.01',   precioBase: 25000, ajusteNino: -2000, ajusteEspecial: 2000,  tieneColores: true,  tieneTalles: true  },
  'buzo-redondo':    { nombre: 'Buzo cuello redondo',     precioBase: 40000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'buzo-canguro':    { nombre: 'Buzo canguro',            precioBase: 45000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'campera-capucha': { nombre: 'Campera con capucha',     precioBase: 48000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'taza':            { nombre: 'Taza cerámica',           precioBase: 10000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: false, tieneTalles: false },
  'gorra':           { nombre: 'Gorra',                   precioBase: 10000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: true,  tieneTalles: false },
  'totebag':         { nombre: 'Totebag',                 precioBase: 12000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: false, tieneTalles: false },
};

const COLORES = ['Blanco', 'Negro', 'Gris', 'Rojo', 'Otro'];
const TALLES  = ['Niño', 'S', 'M', 'L', 'XL', 'XXL', 'Especial'];

const ESTADOS = {
  confirmado: 'Confirmado',
  produccion: 'En producción',
  listo:      'Listo',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
};

// ═══════════════════════════════════════════════
//  DATOS (localStorage)
// ═══════════════════════════════════════════════
const DB = {
  get: key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  pedidos:       () => DB.get('sg_pedidos'),
  presupuestos:  () => DB.get('sg_presupuestos'),
  stock:         () => DB.get('sg_stock'),
  savePedidos:      d => DB.set('sg_pedidos', d),
  savePresupuestos: d => DB.set('sg_presupuestos', d),
  saveStock:        d => DB.set('sg_stock', d),
};

function nextNum(tipo) {
  const items  = tipo === 'pedido' ? DB.pedidos() : DB.presupuestos();
  const prefix = tipo === 'pedido' ? 'P-' : 'PR-';
  if (!items.length) return prefix + '0001';
  const nums = items.map(i => parseInt(i.numero.replace(/\D/g, '')) || 0);
  return prefix + String(Math.max(...nums) + 1).padStart(4, '0');
}

// ═══════════════════════════════════════════════
//  PRECIOS
// ═══════════════════════════════════════════════
function precioItem(productoId, talle) {
  const p = CATALOGO[productoId];
  if (!p) return 0;
  let precio = p.precioBase;
  if (p.tieneTalles) {
    if (talle === 'Niño')    precio += p.ajusteNino;
    if (talle === 'Especial') precio += p.ajusteEspecial;
  }
  return precio;
}

// ═══════════════════════════════════════════════
//  NAVEGACIÓN
// ═══════════════════════════════════════════════
function nav(section) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === section));
  if (section === 'dashboard')    renderDashboard();
  if (section === 'pedidos')      renderPedidos();
  if (section === 'presupuestos') renderPresupuestos();
  if (section === 'stock')        renderStock();
  if (section === 'nuevo-pedido') initForm();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', e => { e.preventDefault(); nav(el.dataset.section); })
);

// ═══════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const pedidos = DB.pedidos();
  const activos  = pedidos.filter(p => !['entregado','cancelado'].includes(p.estado));
  const produccion = pedidos.filter(p => p.estado === 'produccion');
  const listos     = pedidos.filter(p => p.estado === 'listo');

  const totalCobrarPendiente = pedidos
    .filter(p => p.estado !== 'cancelado' && !p.cobro?.saldoPagado)
    .reduce((s, p) => s + ((p.total || 0) - (p.cobro?.senaPagada ? (p.cobro.sena || 0) : 0)), 0);

  document.getElementById('stat-activos').textContent    = activos.length;
  document.getElementById('stat-produccion').textContent = produccion.length;
  document.getElementById('stat-listos').textContent     = listos.length;
  document.getElementById('stat-cobrar').textContent     = pesos(totalCobrarPendiente);

  const hoy = new Date();
  const enSemana = activos
    .filter(p => p.fechaEntrega && diffDias(p.fechaEntrega) <= 7 && diffDias(p.fechaEntrega) >= 0)
    .sort((a,b) => new Date(a.fechaEntrega) - new Date(b.fechaEntrega));

  const tbody = document.getElementById('urgentes-tbody');
  const mobileEl = document.getElementById('urgentes-mobile');
  if (!enSemana.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No hay pedidos para los próximos 7 días</div></td></tr>`;
    mobileEl.innerHTML = `<div class="empty-state">No hay pedidos para los próximos 7 días</div>`;
    return;
  }
  tbody.innerHTML = enSemana.map(p => `
    <tr onclick="abrirDetalle('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td class="${diffDias(p.fechaEntrega) <= 2 ? 'urgente' : ''}">${fecha(p.fechaEntrega)}</td>
      <td><span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span></td>
      <td><span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span></td>
    </tr>`).join('');
  mobileEl.innerHTML = enSemana.map(p => `
    <div class="pedido-card" onclick="abrirDetalle('${p.id}')">
      <div class="pedido-card-top">
        <div><div class="pedido-card-num">${p.numero}</div><div class="pedido-card-nombre">${p.cliente}</div></div>
        <span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span>
      </div>
      <div class="pedido-card-productos">${resumenProductos(p)}</div>
      <div class="pedido-card-bottom">
        <span class="pedido-card-fecha ${diffDias(p.fechaEntrega) <= 2 ? 'urgente' : ''}">📅 ${fecha(p.fechaEntrega)}</span>
        <span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  LISTA PEDIDOS
// ═══════════════════════════════════════════════
let filtroActivo = 'todos';
let busqueda = '';

function renderPedidos() {
  let lista = DB.pedidos();

  if (filtroActivo !== 'todos') lista = lista.filter(p => p.estado === filtroActivo);
  if (busqueda) lista = lista.filter(p =>
    p.cliente.toLowerCase().includes(busqueda) || p.numero.toLowerCase().includes(busqueda)
  );
  lista.sort((a,b) => {
    if (!a.fechaEntrega) return 1;
    if (!b.fechaEntrega) return -1;
    return new Date(a.fechaEntrega) - new Date(b.fechaEntrega);
  });

  document.querySelectorAll('#pedidos .filter-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.filter === filtroActivo)
  );

  const tbody   = document.getElementById('pedidos-tbody');
  const mobileEl = document.getElementById('pedidos-mobile');
  if (!lista.length) {
    tbody.innerHTML    = `<tr><td colspan="7"><div class="empty-state">No hay pedidos</div></td></tr>`;
    mobileEl.innerHTML = `<div class="empty-state">No hay pedidos</div>`;
    return;
  }
  tbody.innerHTML = lista.map(p => `
    <tr onclick="abrirDetalle('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}<br><small style="color:#94a3b8">${p.telefono || ''}</small></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td class="${diffDias(p.fechaEntrega) <= 2 && !['entregado','cancelado'].includes(p.estado) ? 'urgente' : ''}">${fecha(p.fechaEntrega)}</td>
      <td><span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span></td>
      <td><span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span></td>
      <td><strong>${pesos(p.total)}</strong></td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(p => `
    <div class="pedido-card" onclick="abrirDetalle('${p.id}')">
      <div class="pedido-card-top">
        <div><div class="pedido-card-num">${p.numero}</div><div class="pedido-card-nombre">${p.cliente}</div></div>
        <span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span>
      </div>
      <div class="pedido-card-productos">${resumenProductos(p)}</div>
      <div class="pedido-card-bottom">
        <span class="pedido-card-fecha ${diffDias(p.fechaEntrega) <= 2 && !['entregado','cancelado'].includes(p.estado) ? 'urgente' : ''}">📅 ${fecha(p.fechaEntrega)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span>
          <span class="pedido-card-monto">${pesos(p.total)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  LISTA PRESUPUESTOS
// ═══════════════════════════════════════════════
function renderPresupuestos() {
  const lista = DB.presupuestos();
  const tbody    = document.getElementById('presupuestos-tbody');
  const mobileEl = document.getElementById('presupuestos-mobile');
  if (!lista.length) {
    tbody.innerHTML    = `<tr><td colspan="6"><div class="empty-state">No hay presupuestos activos</div></td></tr>`;
    mobileEl.innerHTML = `<div class="empty-state">No hay presupuestos activos</div>`;
    return;
  }
  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}<br><small style="color:#94a3b8">${p.telefono || ''}</small></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td>${fecha(p.fecha)}</td>
      <td><strong>${pesos(p.total)}</strong></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="confirmarPresupuesto('${p.id}',event)">Confirmar pedido</button>
          <button class="btn btn-secondary btn-sm" onclick="editarPresupuesto('${p.id}',event)">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="descartarPresupuesto('${p.id}',event)">Descartar</button>
        </div>
      </td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(p => `
    <div class="presup-card">
      <div class="presup-card-top">
        <span class="presup-card-nombre">${p.cliente}</span>
        <span style="font-weight:700">${pesos(p.total)}</span>
      </div>
      <div class="presup-card-num">${p.numero} · ${fecha(p.fecha)}</div>
      <div class="presup-card-productos">${resumenProductos(p)}</div>
      <div class="presup-card-actions">
        <button class="btn btn-primary btn-sm" onclick="confirmarPresupuesto('${p.id}',event)">✓ Confirmar</button>
        <button class="btn btn-secondary btn-sm" onclick="editarPresupuesto('${p.id}',event)">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="descartarPresupuesto('${p.id}',event)">✕</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  FORMULARIO NUEVO PEDIDO
// ═══════════════════════════════════════════════
let lineas = [];
let editId = null;
let editTipo = null;

function initForm(data = null, tipo = null) {
  editId   = data?.id || null;
  editTipo = tipo || null;
  lineas   = [];

  document.getElementById('form-title').textContent =
    data ? (tipo === 'presupuesto' ? 'Editar presupuesto' : 'Editar pedido') : 'Nuevo pedido / presupuesto';

  document.getElementById('f-cliente').value    = data?.cliente || '';
  document.getElementById('f-telefono').value   = data?.telefono || '';
  document.getElementById('f-entrega').value    = data?.fechaEntrega || '';
  document.getElementById('f-notas').value      = data?.notas || '';
  document.getElementById('f-diseno').value     = data?.diseno?.tipo || 'nuestro';
  document.getElementById('f-diseno-notas').value = data?.diseno?.notas || '';

  document.getElementById('lineas-container').innerHTML = '';

  if (data?.productos?.length) data.productos.forEach(p => agregarLinea(p));
  else agregarLinea();

  calcularTotal();
}

function agregarLinea(data = null) {
  const idx = lineas.length;
  lineas.push(data ? { ...data } : { productoId: '', color: '', talle: '', cantidad: 1 });
  renderLinea(idx);
}

function renderLinea(idx) {
  const container = document.getElementById('lineas-container');
  const existing  = document.getElementById(`linea-${idx}`);
  const ln  = lineas[idx];
  const prod = ln.productoId ? CATALOGO[ln.productoId] : null;
  const subtotal = prod ? precioItem(ln.productoId, ln.talle) * (ln.cantidad || 1) : 0;

  const colorOpts = COLORES.map(c => `<option value="${c}" ${ln.color === c ? 'selected' : ''}>${c}</option>`).join('');
  const talleOpts = TALLES.map(t => `<option value="${t}" ${ln.talle === t ? 'selected' : ''}>${t}</option>`).join('');
  const prodOpts  = Object.entries(CATALOGO).map(([id,p]) =>
    `<option value="${id}" ${ln.productoId === id ? 'selected' : ''}>${p.nombre}</option>`
  ).join('');

  const html = `
    <div class="product-line" id="linea-${idx}">
      <div class="product-line-header">
        <span class="product-line-num">Ítem ${idx + 1}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="product-line-price">${subtotal > 0 ? pesos(subtotal) : '—'}</span>
          ${lineas.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="quitarLinea(${idx})">✕</button>` : ''}
        </div>
      </div>
      <div class="form-row cols-2" style="margin-bottom:${prod?.tieneColores || prod?.tieneTalles ? '10px' : '0'}">
        <div class="form-group" style="margin-bottom:0">
          <label>Producto</label>
          <select class="form-control" onchange="cambiarLinea(${idx},'productoId',this.value)">
            <option value="">Seleccionar producto...</option>${prodOpts}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Cantidad</label>
          <input type="number" class="form-control" min="1" value="${ln.cantidad || 1}"
            onchange="cambiarLinea(${idx},'cantidad',parseInt(this.value)||1)">
        </div>
      </div>
      ${prod?.tieneColores || prod?.tieneTalles ? `
      <div class="form-row ${prod.tieneColores && prod.tieneTalles ? 'cols-2' : ''}">
        ${prod.tieneColores ? `
        <div class="form-group" style="margin-bottom:0">
          <label>Color</label>
          <select class="form-control" onchange="cambiarLinea(${idx},'color',this.value)">
            <option value="">Seleccionar...</option>${colorOpts}
          </select>
        </div>` : ''}
        ${prod.tieneTalles ? `
        <div class="form-group" style="margin-bottom:0">
          <label>Talle</label>
          <select class="form-control" onchange="cambiarLinea(${idx},'talle',this.value)">
            <option value="">Seleccionar...</option>${talleOpts}
          </select>
        </div>` : ''}
      </div>` : ''}
    </div>`;

  if (existing) existing.outerHTML = html;
  else container.insertAdjacentHTML('beforeend', html);
  calcularTotal();
}

function cambiarLinea(idx, campo, valor) {
  lineas[idx][campo] = valor;
  renderLinea(idx);
}

function quitarLinea(idx) {
  lineas.splice(idx, 1);
  document.getElementById('lineas-container').innerHTML = '';
  lineas.forEach((_, i) => renderLinea(i));
  calcularTotal();
}

function calcularTotal() {
  const total = lineas.reduce((s, ln) => {
    if (!ln.productoId) return s;
    return s + precioItem(ln.productoId, ln.talle) * (ln.cantidad || 1);
  }, 0);
  document.getElementById('sum-total').textContent  = pesos(total);
  document.getElementById('sum-sena').textContent   = pesos(total * 0.5);
  document.getElementById('sum-saldo').textContent  = pesos(total * 0.5);
  return total;
}

function obtenerDatosForm() {
  const total = calcularTotal();
  return {
    cliente:      document.getElementById('f-cliente').value.trim(),
    telefono:     document.getElementById('f-telefono').value.trim(),
    fechaEntrega: document.getElementById('f-entrega').value,
    notas:        document.getElementById('f-notas').value.trim(),
    diseno: {
      tipo:  document.getElementById('f-diseno').value,
      notas: document.getElementById('f-diseno-notas').value.trim(),
    },
    productos: lineas.filter(l => l.productoId),
    total,
  };
}

function validarForm(data) {
  if (!data.cliente)          { alert('Ingresá el nombre del cliente'); return false; }
  if (!data.productos.length) { alert('Agregá al menos un producto'); return false; }
  return true;
}

function guardarPresupuesto() {
  const data = obtenerDatosForm();
  if (!validarForm(data)) return;
  const lista = DB.presupuestos();
  if (editId && editTipo === 'presupuesto') {
    const idx = lista.findIndex(p => p.id === editId);
    lista[idx] = { ...lista[idx], ...data };
  } else {
    lista.push({
      id: uid(), numero: nextNum('presupuesto'),
      fecha: new Date().toISOString(),
      historial: [log('Presupuesto creado')],
      ...data,
    });
  }
  DB.savePresupuestos(lista);
  nav('presupuestos');
}

function confirmarPedido() {
  const data = obtenerDatosForm();
  if (!validarForm(data)) return;
  const lista = DB.pedidos();
  if (editId && editTipo === 'pedido') {
    const idx = lista.findIndex(p => p.id === editId);
    lista[idx] = { ...lista[idx], ...data, historial: [...(lista[idx].historial||[]), log('Pedido editado')] };
  } else {
    lista.push({
      id: uid(), numero: nextNum('pedido'),
      fechaPedido: new Date().toISOString(),
      estado: 'confirmado',
      cobro: { sena: data.total * 0.5, senaPagada: false, saldoPagado: false, metodoPago: '' },
      historial: [log('Pedido confirmado')],
      ...data,
    });
  }
  DB.savePedidos(lista);
  nav('pedidos');
}

// ═══════════════════════════════════════════════
//  CONFIRMAR / EDITAR / DESCARTAR PRESUPUESTO
// ═══════════════════════════════════════════════
function confirmarPresupuesto(id, e) {
  e.stopPropagation();
  const lista = DB.presupuestos();
  const idx   = lista.findIndex(p => p.id === id);
  const pres  = lista[idx];
  const pedidos = DB.pedidos();
  pedidos.push({
    ...pres,
    id: uid(), numero: nextNum('pedido'),
    fechaPedido: new Date().toISOString(),
    estado: 'confirmado',
    cobro: { sena: pres.total * 0.5, senaPagada: false, saldoPagado: false, metodoPago: '' },
    historial: [log(`Convertido desde presupuesto ${pres.numero}`)],
  });
  DB.savePedidos(pedidos);
  lista.splice(idx, 1);
  DB.savePresupuestos(lista);
  renderPresupuestos();
  renderDashboard();
}

function editarPresupuesto(id, e) {
  e.stopPropagation();
  const pres = DB.presupuestos().find(p => p.id === id);
  nav('nuevo-pedido');
  initForm(pres, 'presupuesto');
}

function descartarPresupuesto(id, e) {
  e.stopPropagation();
  if (!confirm('¿Descartar este presupuesto?')) return;
  DB.savePresupuestos(DB.presupuestos().filter(p => p.id !== id));
  renderPresupuestos();
}

// ═══════════════════════════════════════════════
//  DETALLE DE PEDIDO (modal)
// ═══════════════════════════════════════════════
function abrirDetalle(id) {
  const p = DB.pedidos().find(x => x.id === id);
  if (!p) return;
  const saldo = p.total - (p.cobro?.sena || p.total * 0.5);

  document.getElementById('modal-content').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap">
      <h2 style="font-size:1.2rem;font-weight:700">${p.numero} — ${p.cliente}</h2>
      <span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span>
    </div>

    <div class="detail-block">
      <h4>Datos del pedido</h4>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Teléfono</div><div class="value">${p.telefono || '—'}</div></div>
        <div class="detail-item"><div class="label">Fecha pedido</div><div class="value">${fecha(p.fechaPedido)}</div></div>
        <div class="detail-item"><div class="label">Fecha entrega</div>
          <div class="value ${diffDias(p.fechaEntrega) <= 2 && !['entregado','cancelado'].includes(p.estado) ? 'urgente' : ''}">${fecha(p.fechaEntrega)}</div>
        </div>
        <div class="detail-item"><div class="label">Diseño</div>
          <div class="value">${p.diseno?.tipo === 'nuestro' ? 'Lo diseñamos nosotros' : 'Lo envía el cliente'}</div>
        </div>
      </div>
      ${p.notas ? `<p style="margin-top:10px;font-size:0.85rem;color:#475569;background:#f8fafc;padding:8px 12px;border-radius:6px">${p.notas}</p>` : ''}
      ${p.diseno?.notas ? `<p style="margin-top:6px;font-size:0.82rem;color:#64748b">Notas diseño: ${p.diseno.notas}</p>` : ''}
    </div>

    <div class="detail-block">
      <h4>Productos</h4>
      ${(p.productos||[]).map(pr => `
        <div class="product-detail-row">
          <div>
            <strong>${CATALOGO[pr.productoId]?.nombre || pr.productoId}</strong>
            ${[pr.talle, pr.color].filter(Boolean).map(v => `<span style="background:#e2e8f0;padding:1px 7px;border-radius:10px;font-size:0.75rem;margin-left:6px">${v}</span>`).join('')}
          </div>
          <div style="display:flex;gap:14px;align-items:center">
            <span style="color:#64748b">×${pr.cantidad}</span>
            <strong>${pesos(precioItem(pr.productoId, pr.talle) * pr.cantidad)}</strong>
          </div>
        </div>`).join('')}
    </div>

    <div class="detail-block">
      <h4>Cobro</h4>
      <div class="cobro-box">
        <div class="cobro-row"><span>Total</span><strong>${pesos(p.total)}</strong></div>
        <div class="cobro-row">
          <span>Seña (50%) — ${pesos(p.cobro?.sena || p.total*0.5)}</span>
          <div style="display:flex;gap:8px;align-items:center">
            ${p.cobro?.senaPagada
              ? `<span class="cobro-badge cobro-completo">Pagada ✓</span>`
              : `<button class="btn btn-primary btn-sm" onclick="marcarSena('${p.id}')">Marcar pagada</button>`}
          </div>
        </div>
        <div class="cobro-row">
          <span>Saldo — ${pesos(saldo)}</span>
          <div style="display:flex;gap:8px;align-items:center">
            ${p.cobro?.saldoPagado
              ? `<span class="cobro-badge cobro-completo">Pagado ✓</span>`
              : `<button class="btn btn-primary btn-sm" ${!p.cobro?.senaPagada ? 'disabled title="Primero marcá la seña"' : ''} onclick="marcarSaldo('${p.id}')">Marcar pagado</button>`}
          </div>
        </div>
      </div>
    </div>

    <div class="detail-block">
      <h4>Estado del pedido</h4>
      <div class="estado-btns">
        ${Object.entries(ESTADOS).map(([est,lbl]) => `
          <button class="btn btn-sm ${p.estado === est ? 'btn-primary' : 'btn-secondary'}"
            onclick="cambiarEstado('${p.id}','${est}')">
            ${lbl}
          </button>`).join('')}
      </div>
    </div>

    <div class="detail-block">
      <h4>Historial</h4>
      ${(p.historial||[]).slice().reverse().map(h => `
        <div class="historial-item">
          <span class="historial-fecha">${fechaCorta(h.fecha)}</span>
          <span>${h.accion}</span>
        </div>`).join('') || '<p style="color:#94a3b8;font-size:0.83rem">Sin historial</p>'}
    </div>

    <div style="display:flex;gap:8px;padding-top:14px;border-top:1px solid #e2e8f0;margin-top:4px">
      <button class="btn btn-secondary" onclick="editarPedido('${p.id}')">Editar</button>
      <button class="btn btn-danger" onclick="eliminarPedido('${p.id}')">Eliminar pedido</button>
    </div>`;

  document.getElementById('modal-detalle').classList.add('active');
}

function cerrarModal() { document.getElementById('modal-detalle').classList.remove('active'); }

function marcarSena(id) {
  const lista = DB.pedidos();
  const idx   = lista.findIndex(p => p.id === id);
  lista[idx].cobro.senaPagada = true;
  lista[idx].historial.push(log('Seña marcada como pagada'));
  DB.savePedidos(lista);
  abrirDetalle(id);
  renderPedidos();
  renderDashboard();
}

function marcarSaldo(id) {
  const lista = DB.pedidos();
  const idx   = lista.findIndex(p => p.id === id);
  lista[idx].cobro.saldoPagado = true;
  lista[idx].historial.push(log('Saldo marcado como pagado'));
  DB.savePedidos(lista);
  abrirDetalle(id);
  renderPedidos();
  renderDashboard();
}

function cambiarEstado(id, nuevoEstado) {
  const lista = DB.pedidos();
  const idx   = lista.findIndex(p => p.id === id);
  const prev  = lista[idx].estado;
  lista[idx].estado = nuevoEstado;
  lista[idx].historial.push(log(`Estado: ${ESTADOS[prev]} → ${ESTADOS[nuevoEstado]}`));
  DB.savePedidos(lista);
  abrirDetalle(id);
  renderPedidos();
  renderDashboard();
}

function editarPedido(id) {
  const p = DB.pedidos().find(x => x.id === id);
  cerrarModal();
  nav('nuevo-pedido');
  initForm(p, 'pedido');
}

function eliminarPedido(id) {
  if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return;
  DB.savePedidos(DB.pedidos().filter(p => p.id !== id));
  cerrarModal();
  renderPedidos();
  renderDashboard();
}

// ═══════════════════════════════════════════════
//  STOCK
// ═══════════════════════════════════════════════
function renderStock() {
  const lista = DB.stock();
  const tbody    = document.getElementById('stock-tbody');
  const mobileEl = document.getElementById('stock-mobile');
  if (!lista.length) {
    tbody.innerHTML    = `<tr><td colspan="5"><div class="empty-state">No hay ítems en stock.</div></td></tr>`;
    mobileEl.innerHTML = `<div class="empty-state">No hay ítems en stock.</div>`;
    return;
  }
  tbody.innerHTML = lista.map(s => `
    <tr>
      <td><strong>${CATALOGO[s.productoId]?.nombre || s.productoId}</strong></td>
      <td>${s.color || '—'}</td>
      <td>${s.talle || '—'}</td>
      <td>
        <span style="font-weight:700;color:${s.cantidad <= 2 ? '#ef4444' : '#10b981'}">${s.cantidad}</span>
        ${s.cantidad <= 2 ? ' <span style="color:#ef4444;font-size:0.72rem">⚠ bajo</span>' : ''}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editarStock('${s.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="eliminarStock('${s.id}')">✕</button>
      </td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(s => `
    <div class="stock-card">
      <div class="stock-card-info">
        <div class="stock-card-nombre">${CATALOGO[s.productoId]?.nombre || s.productoId}</div>
        <div class="stock-card-detalle">${[s.talle, s.color].filter(Boolean).join(' · ') || '—'}</div>
        ${s.cantidad <= 2 ? '<div style="color:#ef4444;font-size:0.75rem;margin-top:2px">⚠ Stock bajo</div>' : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="stock-card-cantidad" style="color:${s.cantidad <= 2 ? '#ef4444' : '#10b981'}">${s.cantidad}</div>
        <div class="stock-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="editarStock('${s.id}')">✏</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarStock('${s.id}')">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function abrirStockModal(item = null) {
  document.getElementById('stock-id').value        = item?.id || '';
  document.getElementById('stock-producto').value  = item?.productoId || '';
  document.getElementById('stock-color').value     = item?.color || '';
  document.getElementById('stock-talle').value     = item?.talle || '';
  document.getElementById('stock-cantidad').value  = item?.cantidad || 1;
  actualizarCamposStock();
  document.getElementById('modal-stock').classList.add('active');
}

function cerrarStockModal() { document.getElementById('modal-stock').classList.remove('active'); }

function actualizarCamposStock() {
  const prod = CATALOGO[document.getElementById('stock-producto').value];
  document.getElementById('stock-color-wrap').style.display = prod?.tieneColores ? 'block' : 'none';
  document.getElementById('stock-talle-wrap').style.display = prod?.tieneTalles  ? 'block' : 'none';
}

function guardarStock() {
  const id        = document.getElementById('stock-id').value;
  const productoId = document.getElementById('stock-producto').value;
  const color     = document.getElementById('stock-color').value;
  const talle     = document.getElementById('stock-talle').value;
  const cantidad  = parseInt(document.getElementById('stock-cantidad').value) || 0;
  if (!productoId) { alert('Seleccioná un producto'); return; }
  const lista = DB.stock();
  if (id) {
    const idx = lista.findIndex(s => s.id === id);
    lista[idx] = { ...lista[idx], productoId, color, talle, cantidad };
  } else {
    lista.push({ id: uid(), productoId, color, talle, cantidad });
  }
  DB.saveStock(lista);
  cerrarStockModal();
  renderStock();
}

function editarStock(id)   { abrirStockModal(DB.stock().find(s => s.id === id)); }
function eliminarStock(id) {
  if (!confirm('¿Eliminar este ítem?')) return;
  DB.saveStock(DB.stock().filter(s => s.id !== id));
  renderStock();
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function pesos(n) {
  if (n === undefined || n === null) return '—';
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function fecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}

function diffDias(iso) {
  if (!iso) return 9999;
  return (new Date(iso + 'T00:00:00') - new Date()) / 86400000;
}

function resumenProductos(p) {
  return (p.productos||[]).map(pr => `${pr.cantidad}× ${CATALOGO[pr.productoId]?.nombre || pr.productoId}`).join(', ') || '—';
}

function cobroBadge(p) {
  if (p.cobro?.saldoPagado) return 'cobro-completo';
  if (p.cobro?.senaPagada)  return 'cobro-parcial';
  return 'cobro-pendiente';
}

function cobroLabel(p) {
  if (p.cobro?.saldoPagado) return 'Cobrado ✓';
  if (p.cobro?.senaPagada)  return 'Seña ✓';
  return 'Pendiente';
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function log(accion) { return { fecha: new Date().toISOString(), accion }; }

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
nav('dashboard');
