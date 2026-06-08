import { initializeApp }    from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// ═══════════════════════════════════════════════
//  FIREBASE
// ═══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyC7j0S8YsRI30VRdDF2ZhL07eP8xPp79HU",
  authDomain: "la-fabrica-textil.firebaseapp.com",
  projectId: "la-fabrica-textil",
  storageBucket: "la-fabrica-textil.firebasestorage.app",
  messagingSenderId: "980683753016",
  appId: "1:980683753016:web:87d97d9accabba3d9a08cd"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ═══════════════════════════════════════════════
//  CATÁLOGO
// ═══════════════════════════════════════════════
const CATALOGO = {
  'remera-recta':    { nombre: 'Remera recta 20.1',     precioBase: 22000, ajusteNino: -2000, ajusteEspecial: 2000,  tieneColores: true,  tieneTalles: true  },
  'remera-oversize': { nombre: 'Remera oversize 20.01', precioBase: 25000, ajusteNino: -2000, ajusteEspecial: 2000,  tieneColores: true,  tieneTalles: true  },
  'buzo-redondo':    { nombre: 'Buzo cuello redondo',   precioBase: 40000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'buzo-canguro':    { nombre: 'Buzo canguro',          precioBase: 45000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'campera-capucha': { nombre: 'Campera con capucha',   precioBase: 48000, ajusteNino: -2000, ajusteEspecial: 5000,  tieneColores: true,  tieneTalles: true  },
  'taza':            { nombre: 'Taza cerámica',         precioBase: 10000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: false, tieneTalles: false },
  'gorra':           { nombre: 'Gorra',                 precioBase: 10000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: true,  tieneTalles: false },
  'totebag':         { nombre: 'Totebag',               precioBase: 12000, ajusteNino: 0,     ajusteEspecial: 0,     tieneColores: false, tieneTalles: false },
};

// Precios para lista "Conocido / Feria" — sin ajuste por talle
const PRECIOS_CONOCIDO = {
  'remera-recta':    20000,
  'remera-oversize': 23000,
  'buzo-redondo':    38000,
  'buzo-canguro':    43000,
  'campera-capucha': 45000,
  'taza':            10000,
  'gorra':           10000,
  'totebag':         10000,
};

const COLORES = ['Blanco','Negro','Gris','Rojo','Otro'];
const TALLES  = ['Niño','S','M','L','XL','XXL','Especial'];
const RECARGO_ESTAMPA = 2000;

const ESTADOS = {
  confirmado: 'Confirmado',
  produccion: 'En producción',
  listo:      'Listo',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
};

const LABELS_PRECIO = { normal: '💲 Normal', conocido: '🤝 Conocido', nuestro: '🏠 Nuestro' };

// ═══════════════════════════════════════════════
//  ESTADO LOCAL
// ═══════════════════════════════════════════════
let _pedidos      = [];
let _presupuestos = [];
let _stock        = [];
let _gastos       = [];

// ═══════════════════════════════════════════════
//  FIRESTORE — listeners en tiempo real
// ═══════════════════════════════════════════════
onSnapshot(collection(db,'pedidos'), snap => {
  _pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const s = seccionActiva();
  if (s === 'dashboard')    renderDashboard();
  if (s === 'pedidos')      renderPedidos();
  if (s === 'archivo')      renderArchivo();
  if (s === 'lista-compras') renderListaCompras();
});

onSnapshot(collection(db,'presupuestos'), snap => {
  _presupuestos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (seccionActiva() === 'presupuestos') renderPresupuestos();
});

onSnapshot(collection(db,'stock'), snap => {
  _stock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const s = seccionActiva();
  if (s === 'stock')         renderStock();
  if (s === 'lista-compras') renderListaCompras();
});

onSnapshot(collection(db,'gastos'), snap => {
  _gastos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const s = seccionActiva();
  if (s === 'gastos')     renderGastos();
  if (s === 'dashboard')  renderDashboard();
});

function seccionActiva() { return document.querySelector('.section.active')?.id; }

// ═══════════════════════════════════════════════
//  FIRESTORE helpers
// ═══════════════════════════════════════════════
async function guardarDoc(col, id, data) { await setDoc(doc(db, col, id), data); }
async function eliminarDoc(col, id)      { await deleteDoc(doc(db, col, id)); }

// ═══════════════════════════════════════════════
//  NUMERACIÓN
// ═══════════════════════════════════════════════
function nextNum(tipo) {
  const items  = tipo === 'pedido' ? _pedidos : _presupuestos;
  const prefix = tipo === 'pedido' ? 'P-' : 'PR-';
  if (!items.length) return prefix + '0001';
  const nums = items.map(i => parseInt(i.numero?.replace(/\D/g,'')) || 0);
  return prefix + String(Math.max(...nums) + 1).padStart(4,'0');
}

// ═══════════════════════════════════════════════
//  PRECIOS
// ═══════════════════════════════════════════════
function precioItem(productoId, talle, listaPrecio = 'normal', recargo = false) {
  const extra = recargo ? RECARGO_ESTAMPA : 0;
  if (listaPrecio === 'nuestro')  return extra;
  if (listaPrecio === 'conocido') return (PRECIOS_CONOCIDO[productoId] || 0) + extra;
  // normal
  const prod = CATALOGO[productoId];
  if (!prod) return extra;
  let precio = prod.precioBase;
  if (prod.tieneTalles) {
    if (talle === 'Niño')     precio += prod.ajusteNino;
    if (talle === 'Especial') precio += prod.ajusteEspecial;
  }
  return precio + extra;
}

function getListaPrecio() {
  return document.querySelector('input[name="listaPrecio"]:checked')?.value || 'normal';
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
  if (section === 'archivo')      renderArchivo();
  if (section === 'stock')        renderStock();
  if (section === 'lista-compras') renderListaCompras();
  if (section === 'gastos')       renderGastos();
  if (section === 'nuevo-pedido') initForm();
  window.scrollTo(0,0);
}

function toggleMas() {
  document.getElementById('mas-drawer').classList.toggle('active');
  document.getElementById('mas-overlay').classList.toggle('active');
}

// ═══════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const activos    = _pedidos.filter(p => !['entregado','cancelado'].includes(p.estado));
  const produccion = _pedidos.filter(p => p.estado === 'produccion');
  const listos     = _pedidos.filter(p => p.estado === 'listo');
  const porCobrar  = _pedidos
    .filter(p => p.estado !== 'cancelado' && !p.cobro?.saldoPagado)
    .reduce((s,p) => s + ((p.total||0) - (p.cobro?.senaPagada ? (p.cobro.sena||0) : 0)), 0);

  // Finanzas del mes
  const hoy      = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const ingresos = _pedidos
    .filter(p => p.estado !== 'cancelado')
    .reduce((s,p) => {
      let cobrado = 0;
      if (p.cobro?.senaPagada)  cobrado += (p.cobro.sena || p.total*0.5);
      if (p.cobro?.saldoPagado) cobrado += (p.total - (p.cobro.sena || p.total*0.5));
      return s + cobrado;
    }, 0);
  const gastosMes = _gastos
    .filter(g => (g.fecha||'').startsWith(mesActual))
    .reduce((s,g) => s + (g.total||0), 0);
  const ganancia = ingresos - gastosMes;

  document.getElementById('stat-activos').textContent    = activos.length;
  document.getElementById('stat-produccion').textContent = produccion.length;
  document.getElementById('stat-listos').textContent     = listos.length;
  document.getElementById('stat-cobrar').textContent     = pesos(porCobrar);
  document.getElementById('stat-ingresos').textContent   = pesos(ingresos);
  document.getElementById('stat-gastos').textContent     = pesos(gastosMes);
  const ganEl = document.getElementById('stat-ganancia');
  ganEl.textContent = pesos(ganancia);
  ganEl.style.color = ganancia >= 0 ? '#10b981' : '#ef4444';

  const enSemana = activos
    .filter(p => p.fechaEntrega && diffDias(p.fechaEntrega) <= 7 && diffDias(p.fechaEntrega) >= 0)
    .sort((a,b) => new Date(a.fechaEntrega)-new Date(b.fechaEntrega));

  const tbody    = document.getElementById('urgentes-tbody');
  const mobileEl = document.getElementById('urgentes-mobile');
  const vacio    = `<div class="empty-state">No hay pedidos para los próximos 7 días</div>`;
  if (!enSemana.length) { tbody.innerHTML=`<tr><td colspan="6">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }
  tbody.innerHTML = enSemana.map(p=>`
    <tr onclick="abrirDetalle('${p.id}')">
      <td><strong>${p.numero}</strong></td><td>${p.cliente}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td class="${diffDias(p.fechaEntrega)<=2?'urgente':''}">${fecha(p.fechaEntrega)}</td>
      <td><span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span></td>
      <td><span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span></td>
    </tr>`).join('');
  mobileEl.innerHTML = enSemana.map(p=>pedidoCard(p)).join('');
}

// ═══════════════════════════════════════════════
//  LISTA PEDIDOS
// ═══════════════════════════════════════════════
let _filtro   = 'todos';
let _orden    = 'numero';
let _busqueda = '';
let _busquedaArchivo = '';

function setFiltro(f)  { _filtro = f;   renderPedidos(); }
function setOrden(o)   { _orden = o;    renderPedidos(); }
function setBusqueda(v){ _busqueda = v.toLowerCase(); renderPedidos(); }
function setBusquedaArchivo(v){ _busquedaArchivo = v.toLowerCase(); renderArchivo(); }

function renderPedidos() {
  // Excluir archivados (entregado + cobrado)
  let lista = _pedidos.filter(p => !(p.estado==='entregado' && p.cobro?.saldoPagado));

  // Filtro de estado / cobro
  if (_filtro === 'confirmado')   lista = lista.filter(p => p.estado === 'confirmado');
  else if (_filtro === 'produccion') lista = lista.filter(p => p.estado === 'produccion');
  else if (_filtro === 'listo')   lista = lista.filter(p => p.estado === 'listo');
  else if (_filtro === 'sin-cobrar')  lista = lista.filter(p => !p.cobro?.saldoPagado);
  else if (_filtro === 'sena-pagada') lista = lista.filter(p => p.cobro?.senaPagada && !p.cobro?.saldoPagado);
  else if (_filtro === 'cobrado')     lista = lista.filter(p => p.cobro?.saldoPagado);

  // Búsqueda
  if (_busqueda) lista = lista.filter(p => p.cliente?.toLowerCase().includes(_busqueda) || p.numero?.toLowerCase().includes(_busqueda));

  // Orden
  if (_orden === 'numero') lista.sort((a,b) => numPedido(a.numero) - numPedido(b.numero));
  else if (_orden === 'fecha') lista.sort((a,b) => { if(!a.fechaEntrega) return 1; if(!b.fechaEntrega) return -1; return new Date(a.fechaEntrega)-new Date(b.fechaEntrega); });
  else if (_orden === 'total') lista.sort((a,b) => (b.total||0) - (a.total||0));

  // Actualizar UI filtros y sort
  document.querySelectorAll('#pedidos .filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === _filtro));
  document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === _orden));

  const tbody    = document.getElementById('pedidos-tbody');
  const mobileEl = document.getElementById('pedidos-mobile');
  const vacio    = `<div class="empty-state">No hay pedidos</div>`;
  if (!lista.length) { tbody.innerHTML=`<tr><td colspan="7">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }
  tbody.innerHTML = lista.map(p=>`
    <tr onclick="abrirDetalle('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}<br><small style="color:#94a3b8">${p.telefono||''}</small></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td class="${diffDias(p.fechaEntrega)<=2&&!['entregado','cancelado'].includes(p.estado)?'urgente':''}">${fecha(p.fechaEntrega)}</td>
      <td><span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span><br><span class="badge-precio badge-${p.listaPrecio||'normal'}">${LABELS_PRECIO[p.listaPrecio||'normal']}</span></td>
      <td><span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span></td>
      <td><strong>${pesos(p.total)}</strong></td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(p=>pedidoCard(p)).join('');
}

// ═══════════════════════════════════════════════
//  ARCHIVO
// ═══════════════════════════════════════════════
function renderArchivo() {
  let lista = _pedidos.filter(p => p.estado==='entregado' && p.cobro?.saldoPagado);
  if (_busquedaArchivo) lista = lista.filter(p => p.cliente?.toLowerCase().includes(_busquedaArchivo) || p.numero?.toLowerCase().includes(_busquedaArchivo));
  lista.sort((a,b) => numPedido(b.numero) - numPedido(a.numero));

  const tbody    = document.getElementById('archivo-tbody');
  const mobileEl = document.getElementById('archivo-mobile');
  const vacio    = `<div class="empty-state">No hay pedidos archivados todavía</div>`;
  if (!lista.length) { tbody.innerHTML=`<tr><td colspan="6">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }
  tbody.innerHTML = lista.map(p=>`
    <tr onclick="abrirDetalle('${p.id}')">
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}<br><small style="color:#94a3b8">${p.telefono||''}</small></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td><span class="badge-precio badge-${p.listaPrecio||'normal'}">${LABELS_PRECIO[p.listaPrecio||'normal']}</span></td>
      <td>${fecha(p.fechaEntrega)}</td>
      <td><strong>${pesos(p.total)}</strong></td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(p=>`
    <div class="pedido-card" onclick="abrirDetalle('${p.id}')">
      <div class="pedido-card-top">
        <div><div class="pedido-card-num">${p.numero}</div><div class="pedido-card-nombre">${p.cliente}</div></div>
        <strong>${pesos(p.total)}</strong>
      </div>
      <div class="pedido-card-productos">${resumenProductos(p)}</div>
      <div class="pedido-card-bottom"><span class="pedido-card-fecha">📅 ${fecha(p.fechaEntrega)}</span><span class="cobro-badge cobro-completo">Cobrado ✓</span></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  PRESUPUESTOS
// ═══════════════════════════════════════════════
function renderPresupuestos() {
  const lista    = [..._presupuestos];
  const tbody    = document.getElementById('presupuestos-tbody');
  const mobileEl = document.getElementById('presupuestos-mobile');
  const vacio    = `<div class="empty-state">No hay presupuestos activos</div>`;
  if (!lista.length) { tbody.innerHTML=`<tr><td colspan="7">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }
  tbody.innerHTML = lista.map(p=>`
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td>${p.cliente}<br><small style="color:#94a3b8">${p.telefono||''}</small></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenProductos(p)}</td>
      <td><span class="badge-precio badge-${p.listaPrecio||'normal'}">${LABELS_PRECIO[p.listaPrecio||'normal']}</span></td>
      <td>${fecha(p.fecha)}</td>
      <td><strong>${pesos(p.total)}</strong></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="confirmarPresupuesto('${p.id}')">Confirmar</button>
          <button class="btn btn-secondary btn-sm" onclick="editarPresupuesto('${p.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="descartarPresupuesto('${p.id}')">✕</button>
        </div>
      </td>
    </tr>`).join('');
  mobileEl.innerHTML = lista.map(p=>`
    <div class="presup-card">
      <div class="presup-card-top"><span class="presup-card-nombre">${p.cliente}</span><strong>${pesos(p.total)}</strong></div>
      <div class="presup-card-num">${p.numero} · ${fecha(p.fecha)} · <span class="badge-precio badge-${p.listaPrecio||'normal'}">${LABELS_PRECIO[p.listaPrecio||'normal']}</span></div>
      <div class="presup-card-productos">${resumenProductos(p)}</div>
      <div class="presup-card-actions">
        <button class="btn btn-primary btn-sm" onclick="confirmarPresupuesto('${p.id}')">✓ Confirmar</button>
        <button class="btn btn-secondary btn-sm" onclick="editarPresupuesto('${p.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="descartarPresupuesto('${p.id}')">✕</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  FORMULARIO NUEVO PEDIDO
// ═══════════════════════════════════════════════
let lineas   = [];
let editId   = null;
let editTipo = null;

function initForm(data = null, tipo = null) {
  editId   = data?.id   || null;
  editTipo = tipo       || null;
  lineas   = [];

  document.getElementById('form-title').textContent =
    data ? (tipo==='presupuesto' ? 'Editar presupuesto' : 'Editar pedido') : 'Nuevo pedido / presupuesto';

  document.getElementById('f-cliente').value      = data?.cliente     || '';
  document.getElementById('f-telefono').value     = data?.telefono    || '';
  document.getElementById('f-entrega').value      = data?.fechaEntrega|| '';
  document.getElementById('f-notas').value        = data?.notas       || '';
  document.getElementById('f-diseno').value       = data?.diseno?.tipo|| 'nuestro';
  document.getElementById('f-diseno-notas').value = data?.diseno?.notas|| '';

  // Lista de precios
  const lp = data?.listaPrecio || 'normal';
  document.querySelectorAll('input[name="listaPrecio"]').forEach(r => r.checked = (r.value === lp));

  document.getElementById('lineas-container').innerHTML = '';
  if (data?.productos?.length) data.productos.forEach(p => agregarLinea(p));
  else agregarLinea();
  calcularTotal();
}

function agregarLinea(data = null) {
  const idx = lineas.length;
  lineas.push(data ? {...data} : { productoId:'', color:'', talle:'', cantidad:1, recargo:false });
  renderLinea(idx);
}

function renderLinea(idx) {
  const container = document.getElementById('lineas-container');
  const existing  = document.getElementById(`linea-${idx}`);
  const ln   = lineas[idx];
  const prod = ln.productoId ? CATALOGO[ln.productoId] : null;
  const lp   = getListaPrecio();
  const subtotal = prod ? precioItem(ln.productoId, ln.talle, lp, ln.recargo) * (ln.cantidad||1) : 0;

  const colorOpts = COLORES.map(c=>`<option value="${c}" ${ln.color===c?'selected':''}>${c}</option>`).join('');
  const talleOpts = TALLES.map(t=>`<option value="${t}" ${ln.talle===t?'selected':''}>${t}</option>`).join('');
  const prodOpts  = Object.entries(CATALOGO).map(([id,p])=>
    `<option value="${id}" ${ln.productoId===id?'selected':''}>${p.nombre}</option>`).join('');

  const html = `
    <div class="product-line" id="linea-${idx}">
      <div class="product-line-header">
        <span class="product-line-num">Ítem ${idx+1}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="product-line-price">${subtotal>0?pesos(subtotal):'—'}</span>
          ${lineas.length>1?`<button class="btn btn-danger btn-sm" onclick="quitarLinea(${idx})">✕</button>`:''}
        </div>
      </div>
      <div class="form-row cols-2" style="margin-bottom:10px">
        <div class="form-group" style="margin-bottom:0"><label>Producto</label>
          <select class="form-control" onchange="cambiarLinea(${idx},'productoId',this.value)">
            <option value="">Seleccionar producto...</option>${prodOpts}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0"><label>Cantidad</label>
          <input type="number" class="form-control" min="1" value="${ln.cantidad||1}" onchange="cambiarLinea(${idx},'cantidad',parseInt(this.value)||1)">
        </div>
      </div>
      ${prod?.tieneColores||prod?.tieneTalles ? `
      <div class="form-row ${prod.tieneColores&&prod.tieneTalles?'cols-2':''}">
        ${prod.tieneColores?`<div class="form-group" style="margin-bottom:0"><label>Color</label><select class="form-control" onchange="cambiarLinea(${idx},'color',this.value)"><option value="">Seleccionar...</option>${colorOpts}</select></div>`:''}
        ${prod.tieneTalles?`<div class="form-group" style="margin-bottom:0"><label>Talle</label><select class="form-control" onchange="cambiarLinea(${idx},'talle',this.value)"><option value="">Seleccionar...</option>${talleOpts}</select></div>`:''}
      </div>` : ''}
      ${prod ? `<div class="recargo-wrap"><label class="recargo-label"><input type="checkbox" ${ln.recargo?'checked':''} onchange="cambiarLinea(${idx},'recargo',this.checked)"><span>Estampa compleja <strong>+$2.000</strong> por unidad</span></label></div>` : ''}
    </div>`;

  if (existing) existing.outerHTML = html;
  else container.insertAdjacentHTML('beforeend', html);
  calcularTotal();
}

function cambiarLinea(idx, campo, valor) { lineas[idx][campo] = valor; renderLinea(idx); }

function quitarLinea(idx) {
  lineas.splice(idx,1);
  document.getElementById('lineas-container').innerHTML = '';
  lineas.forEach((_,i) => renderLinea(i));
  calcularTotal();
}

function recalcularLineas() {
  lineas.forEach((_,i) => renderLinea(i));
  calcularTotal();
}

function calcularTotal() {
  const lp    = getListaPrecio();
  const total = lineas.reduce((s,ln) => {
    if (!ln.productoId) return s;
    return s + precioItem(ln.productoId, ln.talle, lp, ln.recargo) * (ln.cantidad||1);
  }, 0);
  document.getElementById('sum-total').textContent = pesos(total);
  document.getElementById('sum-sena').textContent  = pesos(total*0.5);
  document.getElementById('sum-saldo').textContent = pesos(total*0.5);
  return total;
}

function obtenerDatosForm() {
  const lp    = getListaPrecio();
  const total = calcularTotal();
  return {
    cliente:      document.getElementById('f-cliente').value.trim(),
    telefono:     document.getElementById('f-telefono').value.trim(),
    fechaEntrega: document.getElementById('f-entrega').value,
    notas:        document.getElementById('f-notas').value.trim(),
    diseno: { tipo: document.getElementById('f-diseno').value, notas: document.getElementById('f-diseno-notas').value.trim() },
    listaPrecio:  lp,
    productos:    lineas.filter(l=>l.productoId).map(l=>({...l, precioUnitario: precioItem(l.productoId, l.talle, lp, l.recargo)})),
    total,
  };
}

function validarForm(data) {
  if (!data.cliente)          { alert('Ingresá el nombre del cliente'); return false; }
  if (!data.productos.length) { alert('Agregá al menos un producto'); return false; }
  return true;
}

async function guardarPresupuesto() {
  const data = obtenerDatosForm();
  if (!validarForm(data)) return;
  const id       = editId && editTipo==='presupuesto' ? editId : uid();
  const existing = _presupuestos.find(p=>p.id===id) || {};
  await guardarDoc('presupuestos', id, {
    ...existing, ...data,
    numero:   existing.numero || nextNum('presupuesto'),
    fecha:    existing.fecha  || new Date().toISOString(),
    historial: [...(existing.historial||[]), log(editId?'Presupuesto editado':'Presupuesto creado')],
  });
  nav('presupuestos');
}

async function confirmarPedido() {
  const data = obtenerDatosForm();
  if (!validarForm(data)) return;
  const id       = editId && editTipo==='pedido' ? editId : uid();
  const existing = _pedidos.find(p=>p.id===id) || {};
  await guardarDoc('pedidos', id, {
    ...existing, ...data,
    numero:      existing.numero      || nextNum('pedido'),
    fechaPedido: existing.fechaPedido || new Date().toISOString(),
    estado:      existing.estado      || 'confirmado',
    cobro:       existing.cobro       || { sena: data.total*0.5, senaPagada:false, saldoPagado:false, metodoPago:'' },
    historial:   [...(existing.historial||[]), log(editId?'Pedido editado':'Pedido confirmado')],
  });
  nav('pedidos');
}

// ═══════════════════════════════════════════════
//  PRESUPUESTO → PEDIDO
// ═══════════════════════════════════════════════
async function confirmarPresupuesto(id) {
  const pres = _presupuestos.find(p=>p.id===id);
  if (!pres) return;
  const nuevoId = uid();
  await guardarDoc('pedidos', nuevoId, {
    ...pres, id: nuevoId,
    numero:      nextNum('pedido'),
    fechaPedido: new Date().toISOString(),
    estado:      'confirmado',
    cobro:       { sena: pres.total*0.5, senaPagada:false, saldoPagado:false, metodoPago:'' },
    historial:   [log(`Convertido desde presupuesto ${pres.numero}`)],
  });
  await eliminarDoc('presupuestos', id);
}

function editarPresupuesto(id) {
  const pres = _presupuestos.find(p=>p.id===id);
  nav('nuevo-pedido');
  initForm(pres,'presupuesto');
}

async function descartarPresupuesto(id) {
  if (!confirm('¿Descartar este presupuesto?')) return;
  await eliminarDoc('presupuestos', id);
}

// ═══════════════════════════════════════════════
//  DETALLE DE PEDIDO
// ═══════════════════════════════════════════════
function abrirDetalle(id) {
  const p = _pedidos.find(x=>x.id===id);
  if (!p) return;
  const sena  = p.cobro?.sena ?? p.total*0.5;
  const saldo = p.total - sena;
  const lp    = p.listaPrecio || 'normal';

  document.getElementById('modal-content').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <h2 style="font-size:1.15rem;font-weight:700">${p.numero} — ${p.cliente}</h2>
      <span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span>
      <span class="badge-precio badge-${lp}">${LABELS_PRECIO[lp]}</span>
    </div>

    <div class="detail-block">
      <h4>Datos del pedido</h4>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Teléfono</div><div class="value">${p.telefono||'—'}</div></div>
        <div class="detail-item"><div class="label">Fecha pedido</div><div class="value">${fecha(p.fechaPedido)}</div></div>
        <div class="detail-item"><div class="label">Fecha entrega</div>
          <div class="value ${diffDias(p.fechaEntrega)<=2&&!['entregado','cancelado'].includes(p.estado)?'urgente':''}">${fecha(p.fechaEntrega)}</div>
        </div>
        <div class="detail-item"><div class="label">Diseño</div><div class="value">${p.diseno?.tipo==='nuestro'?'Lo diseñamos nosotros':'Lo envía el cliente'}</div></div>
      </div>
      ${p.notas?`<p style="margin-top:10px;font-size:0.85rem;color:#475569;background:#f8fafc;padding:8px 12px;border-radius:6px">${p.notas}</p>`:''}
      ${p.diseno?.notas?`<p style="margin-top:6px;font-size:0.82rem;color:#64748b">Notas diseño: ${p.diseno.notas}</p>`:''}
    </div>

    <div class="detail-block">
      <h4>Productos</h4>
      ${(p.productos||[]).map(pr=>`
        <div class="product-detail-row">
          <div>
            <strong>${CATALOGO[pr.productoId]?.nombre||pr.productoId}</strong>
            ${[pr.talle,pr.color].filter(Boolean).map(v=>`<span style="background:#e2e8f0;padding:1px 7px;border-radius:10px;font-size:0.72rem;margin-left:5px">${v}</span>`).join('')}
            ${pr.recargo?`<span style="background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:10px;font-size:0.72rem;margin-left:5px">+$2.000 estampa</span>`:''}
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <span style="color:#64748b">×${pr.cantidad}</span>
            <strong>${pesos((pr.precioUnitario||precioItem(pr.productoId,pr.talle,lp,pr.recargo))*pr.cantidad)}</strong>
          </div>
        </div>`).join('')}
    </div>

    <div class="detail-block">
      <h4>Cobro</h4>
      <div class="cobro-box">
        <div class="cobro-row"><span>Total</span><strong>${pesos(p.total)}</strong></div>
        <div class="cobro-row">
          <span>Seña (50%) — ${pesos(sena)}</span>
          ${p.cobro?.senaPagada?`<span class="cobro-badge cobro-completo">Pagada ✓</span>`:`<button class="btn btn-primary btn-sm" onclick="marcarSena('${p.id}')">Marcar pagada</button>`}
        </div>
        <div class="cobro-row">
          <span>Saldo — ${pesos(saldo)}</span>
          ${p.cobro?.saldoPagado?`<span class="cobro-badge cobro-completo">Pagado ✓</span>`:`<button class="btn btn-primary btn-sm" ${!p.cobro?.senaPagada?'disabled':''} onclick="marcarSaldo('${p.id}')">Marcar pagado</button>`}
        </div>
      </div>
    </div>

    <div class="detail-block">
      <h4>Estado del pedido</h4>
      <div class="estado-btns">
        ${Object.entries(ESTADOS).map(([est,lbl])=>`
          <button class="btn btn-sm ${p.estado===est?'btn-primary':'btn-secondary'}" onclick="cambiarEstado('${p.id}','${est}')">${lbl}</button>`).join('')}
      </div>
    </div>

    <div class="detail-block">
      <h4>Historial</h4>
      ${(p.historial||[]).slice().reverse().map(h=>`
        <div class="historial-item"><span class="historial-fecha">${fechaCorta(h.fecha)}</span><span>${h.accion}</span></div>`).join('')||'<p style="color:#94a3b8;font-size:0.83rem">Sin historial</p>'}
    </div>

    <div style="display:flex;gap:8px;padding-top:14px;border-top:1px solid #e2e8f0;margin-top:4px">
      <button class="btn btn-secondary" onclick="editarPedido('${p.id}')">Editar</button>
      <button class="btn btn-danger" onclick="eliminarPedido('${p.id}')">Eliminar</button>
    </div>`;

  document.getElementById('modal-detalle').classList.add('active');
}

function cerrarModal() { document.getElementById('modal-detalle').classList.remove('active'); }

async function marcarSena(id) {
  const p = _pedidos.find(x=>x.id===id); if (!p) return;
  await guardarDoc('pedidos',id,{...p,cobro:{...p.cobro,senaPagada:true},historial:[...(p.historial||[]),log('Seña marcada como pagada')]});
  abrirDetalle(id);
}

async function marcarSaldo(id) {
  const p = _pedidos.find(x=>x.id===id); if (!p) return;
  await guardarDoc('pedidos',id,{...p,cobro:{...p.cobro,saldoPagado:true},historial:[...(p.historial||[]),log('Saldo marcado como pagado')]});
  abrirDetalle(id);
}

async function cambiarEstado(id, nuevoEstado) {
  const p = _pedidos.find(x=>x.id===id); if (!p) return;
  const prevEstado = p.estado;
  const updated = {...p, estado:nuevoEstado, historial:[...(p.historial||[]),log(`Estado: ${ESTADOS[prevEstado]||prevEstado} → ${ESTADOS[nuevoEstado]}`)]};

  // Al marcar como entregado → descontar del stock
  if (nuevoEstado==='entregado' && prevEstado!=='entregado') {
    for (const pr of (p.productos||[])) {
      const si = stockItemMatch(pr.productoId, pr.color||'', pr.talle||'');
      if (si) await guardarDoc('stock', si.id, {...si, cantidad: Math.max(0, si.cantidad-(pr.cantidad||0))});
    }
  }
  // Si se revierte de entregado → devolver al stock
  if (prevEstado==='entregado' && nuevoEstado!=='entregado') {
    for (const pr of (p.productos||[])) {
      const si = stockItemMatch(pr.productoId, pr.color||'', pr.talle||'');
      if (si) await guardarDoc('stock', si.id, {...si, cantidad: si.cantidad+(pr.cantidad||0)});
    }
  }

  await guardarDoc('pedidos', id, updated);
  abrirDetalle(id);
}

function editarPedido(id) {
  const p = _pedidos.find(x=>x.id===id);
  cerrarModal(); nav('nuevo-pedido'); initForm(p,'pedido');
}

async function eliminarPedido(id) {
  if (!confirm('¿Eliminar este pedido?')) return;
  await eliminarDoc('pedidos',id);
  cerrarModal();
}

// ═══════════════════════════════════════════════
//  STOCK
// ═══════════════════════════════════════════════
function calcularComprometido(productoId, color, talle) {
  return _pedidos
    .filter(p => !['entregado','cancelado'].includes(p.estado))
    .reduce((s,p) => s + (p.productos||[])
      .filter(pr => pr.productoId===productoId && (pr.color||'')===(color||'') && (pr.talle||'')===(talle||''))
      .reduce((ss,pr) => ss+(pr.cantidad||0), 0), 0);
}

function stockItemMatch(productoId, color, talle) {
  return _stock.find(s => s.productoId===productoId && (s.color||'')===color && (s.talle||'')===talle);
}

function renderStock() {
  const tbody    = document.getElementById('stock-tbody');
  const mobileEl = document.getElementById('stock-mobile');
  const vacio    = `<div class="empty-state">No hay ítems en stock.</div>`;
  if (!_stock.length) { tbody.innerHTML=`<tr><td colspan="7">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }

  const items = _stock.map(s => {
    const comp  = calcularComprometido(s.productoId, s.color||'', s.talle||'');
    const disp  = s.cantidad - comp;
    return {...s, comprometido: comp, disponible: disp};
  }).sort((a,b) => a.disponible - b.disponible);

  tbody.innerHTML = items.map(s=>`
    <tr>
      <td><strong>${CATALOGO[s.productoId]?.nombre||s.productoId}</strong></td>
      <td>${s.color||'—'}</td><td>${s.talle||'—'}</td>
      <td><strong style="color:#10b981">${s.cantidad}</strong></td>
      <td style="color:#f59e0b">${s.comprometido}</td>
      <td><strong style="color:${s.disponible<0?'#ef4444':s.disponible===0?'#f59e0b':'#10b981'}">${s.disponible}${s.disponible<0?' ⚠':''}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editarStock('${s.id}')">✏</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarStock('${s.id}')">✕</button>
      </td>
    </tr>`).join('');
  mobileEl.innerHTML = items.map(s=>`
    <div class="stock-card">
      <div class="stock-card-info">
        <div class="stock-card-nombre">${CATALOGO[s.productoId]?.nombre||s.productoId}</div>
        <div class="stock-card-detalle">${[s.talle,s.color].filter(Boolean).join(' · ')||'—'}</div>
        <div style="font-size:0.78rem;margin-top:3px">
          Stock: <strong style="color:#10b981">${s.cantidad}</strong> ·
          Comprometido: <strong style="color:#f59e0b">${s.comprometido}</strong> ·
          Disponible: <strong style="color:${s.disponible<0?'#ef4444':'#10b981'}">${s.disponible}</strong>
        </div>
      </div>
      <div class="stock-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editarStock('${s.id}')">✏</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarStock('${s.id}')">✕</button>
      </div>
    </div>`).join('');
}

function abrirStockModal(item=null) {
  document.getElementById('stock-id').value       = item?.id||'';
  document.getElementById('stock-producto').value = item?.productoId||'';
  document.getElementById('stock-color').value    = item?.color||'';
  document.getElementById('stock-talle').value    = item?.talle||'';
  document.getElementById('stock-cantidad').value = item?.cantidad||1;
  actualizarCamposStock();
  document.getElementById('modal-stock').classList.add('active');
}
function cerrarStockModal() { document.getElementById('modal-stock').classList.remove('active'); }
function actualizarCamposStock() {
  const prod = CATALOGO[document.getElementById('stock-producto').value];
  document.getElementById('stock-color-wrap').style.display = prod?.tieneColores?'block':'none';
  document.getElementById('stock-talle-wrap').style.display = prod?.tieneTalles?'block':'none';
}
async function guardarStock() {
  const id        = document.getElementById('stock-id').value||uid();
  const productoId = document.getElementById('stock-producto').value;
  const color     = document.getElementById('stock-color').value;
  const talle     = document.getElementById('stock-talle').value;
  const cantidad  = parseInt(document.getElementById('stock-cantidad').value)||0;
  if (!productoId) { alert('Seleccioná un producto'); return; }
  await guardarDoc('stock',id,{productoId,color,talle,cantidad});
  cerrarStockModal();
}
function editarStock(id) { abrirStockModal(_stock.find(s=>s.id===id)); }
async function eliminarStock(id) {
  if (!confirm('¿Eliminar este ítem?')) return;
  await eliminarDoc('stock',id);
}

// ═══════════════════════════════════════════════
//  LISTA DE COMPRAS
// ═══════════════════════════════════════════════
function renderListaCompras() {
  const pedidosActivos = _pedidos.filter(p => !['entregado','cancelado'].includes(p.estado));
  const mapa = {};
  pedidosActivos.forEach(p => {
    (p.productos||[]).forEach(pr => {
      const key = `${pr.productoId}||${pr.color||''}||${pr.talle||''}`;
      if (!mapa[key]) mapa[key] = { productoId:pr.productoId, color:pr.color||'', talle:pr.talle||'', necesario:0 };
      mapa[key].necesario += (pr.cantidad||0);
    });
  });

  const items = Object.values(mapa).map(item => {
    const si      = stockItemMatch(item.productoId, item.color, item.talle);
    const enStock = si?.cantidad || 0;
    return {...item, enStock, faltante: Math.max(0, item.necesario - enStock)};
  }).sort((a,b) => b.faltante - a.faltante);

  const hayFaltantes = items.some(i => i.faltante > 0);
  document.getElementById('lista-compras-ok').style.display   = hayFaltantes ? 'none' : 'block';
  document.getElementById('lista-compras-card').style.display = items.length  ? 'block' : 'none';

  const tbody    = document.getElementById('compras-tbody');
  const mobileEl = document.getElementById('compras-mobile');
  if (!items.length) { tbody.innerHTML=`<tr><td colspan="6"><div class="empty-state">No hay pedidos activos</div></td></tr>`; mobileEl.innerHTML=''; return; }

  tbody.innerHTML = items.map(i=>`
    <tr class="${i.faltante>0?'faltante-row':''}">
      <td><strong>${CATALOGO[i.productoId]?.nombre||i.productoId}</strong></td>
      <td>${i.color||'—'}</td><td>${i.talle||'—'}</td>
      <td>${i.necesario}</td>
      <td>${i.enStock}</td>
      <td>${i.faltante>0?`<span class="faltante-badge">Comprar ${i.faltante}</span>`:`<span class="ok-badge">✓ Ok</span>`}</td>
    </tr>`).join('');
  mobileEl.innerHTML = items.map(i=>`
    <div class="compra-card" style="${i.faltante>0?'background:#fff7ed':''}">
      <div class="compra-card-top">
        <div><div class="compra-card-nombre">${CATALOGO[i.productoId]?.nombre||i.productoId}</div>
        <div style="font-size:0.78rem;color:#64748b;margin-top:2px">${[i.talle,i.color].filter(Boolean).join(' · ')||'—'}</div></div>
        ${i.faltante>0?`<span class="faltante-badge">Comprar ${i.faltante}</span>`:`<span class="ok-badge">✓ Ok</span>`}
      </div>
      <div style="font-size:0.8rem;color:#64748b;margin-top:6px">Necesario: <strong>${i.necesario}</strong> · En stock: <strong>${i.enStock}</strong></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
//  GASTOS — multi-ítem por compra
// ═══════════════════════════════════════════════
let _gastoItems = [];

// Helper: obtener ítems de un gasto (soporta formato viejo y nuevo)
function itemsDeGasto(g) {
  if (g.items?.length) return g.items;
  if (g.categoria) return [{ categoria:g.categoria, productoId:g.productoId||'', color:g.color||'', talle:g.talle||'', descripcion:g.descripcion||'', cantidad:g.cantidad||0, precioUnitario:g.precioUnitario||null }];
  return [];
}

function resumenItems(g) {
  return itemsDeGasto(g).map(i => {
    const nombre = i.productoId ? CATALOGO[i.productoId]?.nombre : i.descripcion;
    const detalle = [i.talle,i.color].filter(Boolean).join('/');
    return `${i.cantidad||1}× ${nombre||'Ítem'}${detalle?' ('+detalle+')':''}`;
  }).join(', ') || '—';
}

function renderGastos() {
  const hoy       = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const delMes    = _gastos.filter(g => (g.fecha||'').startsWith(mesActual));
  const totalMes  = delMes.reduce((s,g)=>s+(g.total||0),0);

  // Totales por categoría (nuevo y viejo formato)
  const artMes = delMes.reduce((s,g) => {
    if (g.items) return s + g.items.filter(i=>i.categoria==='articulos').reduce((ss,i)=>ss+(i.cantidad||0)*(i.precioUnitario||0),0) + (g.totalManual&&g.items.some(i=>i.categoria==='articulos')?(g.total||0):0);
    return s + (g.categoria==='articulos'?(g.total||0):0);
  }, 0);
  const insMes = delMes.reduce((s,g) => {
    if (g.items) return s + g.items.filter(i=>i.categoria==='insumos').reduce((ss,i)=>ss+(i.cantidad||0)*(i.precioUnitario||0),0);
    return s + (g.categoria==='insumos'?(g.total||0):0);
  }, 0);

  document.getElementById('gasto-total-mes').textContent     = pesos(totalMes);
  document.getElementById('gasto-articulos-mes').textContent = pesos(artMes);
  document.getElementById('gasto-insumos-mes').textContent   = pesos(insMes);

  const lista    = [..._gastos].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const tbody    = document.getElementById('gastos-tbody');
  const mobileEl = document.getElementById('gastos-mobile');
  const vacio    = `<div class="empty-state">No hay gastos registrados</div>`;
  if (!lista.length) { tbody.innerHTML=`<tr><td colspan="6">${vacio}</td></tr>`; mobileEl.innerHTML=vacio; return; }

  tbody.innerHTML = lista.map(g => {
    const items = itemsDeGasto(g);
    return `
    <tr>
      <td>${fecha(g.fecha)}</td>
      <td>${g.proveedor||'—'}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${resumenItems(g)}</td>
      <td>${items.length} ítem${items.length!==1?'s':''}</td>
      <td><strong>${pesos(g.total)}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editarGasto('${g.id}')">✏</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarGasto('${g.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  mobileEl.innerHTML = lista.map(g => {
    const items = itemsDeGasto(g);
    return `
    <div class="gasto-card">
      <div class="gasto-card-top">
        <div>
          <div class="gasto-card-desc">${g.proveedor||'Sin proveedor'}</div>
          <div style="font-size:0.78rem;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${resumenItems(g)}</div>
        </div>
        <strong>${pesos(g.total)}</strong>
      </div>
      <div class="gasto-card-meta">${fecha(g.fecha)} · ${items.length} ítem${items.length!==1?'s':''}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-secondary btn-sm" onclick="editarGasto('${g.id}')">✏ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarGasto('${g.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function abrirGastoModal(gasto=null) {
  _gastoItems = [];
  document.getElementById('gasto-id').value       = gasto?.id||'';
  document.getElementById('gasto-fecha').value    = gasto?.fecha||hoyISO();
  document.getElementById('gasto-proveedor').value = gasto?.proveedor||'';
  document.getElementById('gasto-notas').value    = gasto?.notas||'';
  document.getElementById('gi-total-manual').value = gasto?.total||'';
  document.getElementById('gasto-items-container').innerHTML = '';

  const items = gasto ? itemsDeGasto(gasto) : [];
  if (items.length) items.forEach(i => agregarItemGasto(i));
  else agregarItemGasto();

  calcularTotalGastoModal();
  document.getElementById('modal-gasto').classList.add('active');
}

function cerrarGastoModal() { document.getElementById('modal-gasto').classList.remove('active'); }

function agregarItemGasto(data=null) {
  const idx = _gastoItems.length;
  _gastoItems.push(data ? {...data} : { categoria:'articulos', productoId:'', color:'', talle:'', descripcion:'', cantidad:1, precioUnitario:null });
  renderItemGasto(idx);
}

function renderItemGasto(idx) {
  const container = document.getElementById('gasto-items-container');
  const existing  = document.getElementById(`gi-item-${idx}`);
  const item = _gastoItems[idx];
  const prod = item.categoria==='articulos' && item.productoId ? CATALOGO[item.productoId] : null;
  const subtotal = (item.cantidad||0) * (item.precioUnitario||0);

  const prodOpts  = Object.entries(CATALOGO).map(([id,p])=>`<option value="${id}" ${item.productoId===id?'selected':''}>${p.nombre}</option>`).join('');
  const colorOpts = COLORES.map(c=>`<option value="${c}" ${item.color===c?'selected':''}>${c}</option>`).join('');
  const talleOpts = TALLES.map(t=>`<option value="${t}" ${item.talle===t?'selected':''}>${t}</option>`).join('');

  const html = `
    <div class="product-line" id="gi-item-${idx}">
      <div class="product-line-header">
        <span class="product-line-num">Ítem ${idx+1}</span>
        <div style="display:flex;gap:8px;align-items:center">
          ${subtotal>0?`<span class="product-line-price">${pesos(subtotal)}</span>`:''}
          ${_gastoItems.length>1?`<button class="btn btn-danger btn-sm" onclick="quitarItemGasto(${idx})">✕</button>`:''}
        </div>
      </div>
      <div class="form-row cols-2" style="margin-bottom:10px">
        <div class="form-group" style="margin-bottom:0">
          <label>Categoría</label>
          <select class="form-control" onchange="cambiarItemGasto(${idx},'categoria',this.value)">
            <option value="articulos" ${item.categoria==='articulos'?'selected':''}>🧥 Artículos</option>
            <option value="insumos" ${item.categoria==='insumos'?'selected':''}>🖨 Insumos</option>
            <option value="otro" ${item.categoria==='otro'?'selected':''}>📦 Otro</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Descripción</label>
          <input type="text" class="form-control" value="${item.descripcion||''}" placeholder="Ej: Remeras blancas M"
            onchange="cambiarItemGasto(${idx},'descripcion',this.value)">
        </div>
      </div>
      ${item.categoria==='articulos'?`
      <div class="form-row cols-3" style="margin-bottom:10px">
        <div class="form-group" style="margin-bottom:0">
          <label>Producto</label>
          <select class="form-control" onchange="cambiarItemGasto(${idx},'productoId',this.value)">
            <option value="">Seleccionar...</option>${prodOpts}
          </select>
        </div>
        ${prod?.tieneColores?`<div class="form-group" style="margin-bottom:0"><label>Color</label><select class="form-control" onchange="cambiarItemGasto(${idx},'color',this.value)"><option value="">—</option>${colorOpts}</select></div>`:`<div></div>`}
        ${prod?.tieneTalles?`<div class="form-group" style="margin-bottom:0"><label>Talle</label><select class="form-control" onchange="cambiarItemGasto(${idx},'talle',this.value)"><option value="">—</option>${talleOpts}</select></div>`:`<div></div>`}
      </div>`:''}
      <div class="form-row cols-3">
        <div class="form-group" style="margin-bottom:0">
          <label>Cantidad *</label>
          <input type="number" class="form-control" min="1" value="${item.cantidad||1}"
            onchange="cambiarItemGasto(${idx},'cantidad',parseInt(this.value)||1)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Precio unit. <small style="font-weight:400;color:#94a3b8">(opcional)</small></label>
          <input type="number" class="form-control" value="${item.precioUnitario||''}" placeholder="—"
            onchange="cambiarItemGasto(${idx},'precioUnitario',parseFloat(this.value)||null)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Subtotal</label>
          <input type="text" class="form-control" value="${subtotal>0?pesos(subtotal):'—'}" readonly style="background:#f1f5f9;font-weight:600">
        </div>
      </div>
    </div>`;

  if (existing) existing.outerHTML = html;
  else container.insertAdjacentHTML('beforeend', html);
  calcularTotalGastoModal();
}

function cambiarItemGasto(idx, campo, valor) {
  _gastoItems[idx][campo] = valor;
  renderItemGasto(idx);
}

function quitarItemGasto(idx) {
  _gastoItems.splice(idx, 1);
  document.getElementById('gasto-items-container').innerHTML = '';
  _gastoItems.forEach((_,i) => renderItemGasto(i));
  calcularTotalGastoModal();
}

function calcularTotalGastoModal() {
  const totalCalc = _gastoItems.reduce((s,i) => s + (i.cantidad||0)*(i.precioUnitario||0), 0);
  const hint = document.getElementById('gi-total-calc-hint');
  const campo = document.getElementById('gi-total-manual');
  if (totalCalc > 0) {
    hint.textContent = 'Calculado de los items: ' + pesos(totalCalc);
    if (!campo.dataset.editadoManual) campo.value = totalCalc;
  } else {
    hint.textContent = 'Ingresá el total si no tenés precios por ítem';
    if (!campo.dataset.editadoManual) campo.value = '';
  }
  return totalCalc;
}

function toggleSoloTotal() {}

async function guardarGasto() {
  const id        = document.getElementById('gasto-id').value || uid();
  const fecha_v   = document.getElementById('gasto-fecha').value;
  const proveedor = document.getElementById('gasto-proveedor').value.trim();
  const notas     = document.getElementById('gasto-notas').value.trim();
  calcularTotalGastoModal();
  const total = parseFloat(document.getElementById('gi-total-manual').value) || 0;

  if (!fecha_v)           { alert('Ingresá la fecha'); return; }
  if (!_gastoItems.length){ alert('Agregá al menos un ítem'); return; }
  if (!total)             { alert('Ingresá el total de la compra'); return; }

  const gastoData = {
    fecha: fecha_v, proveedor, notas, total,
    items: _gastoItems,
    // Backward compat
    categoria: _gastoItems[0]?.categoria || 'otro',
    descripcion: _gastoItems.map(i=>i.descripcion||CATALOGO[i.productoId]?.nombre||'').filter(Boolean).join(', '),
  };

  // Revertir stock anterior si es edición
  const prevGasto = _gastos.find(g => g.id === id);
  if (prevGasto) {
    for (const item of itemsDeGasto(prevGasto)) {
      if (item.categoria==='articulos' && item.productoId && item.cantidad) {
        const si = stockItemMatch(item.productoId, item.color||'', item.talle||'');
        if (si) await guardarDoc('stock', si.id, {...si, cantidad: Math.max(0, si.cantidad-(item.cantidad||0))});
      }
    }
  }

  // Aplicar nuevo stock para artículos
  for (const item of _gastoItems) {
    if (item.categoria==='articulos' && item.productoId && (item.cantidad||0) > 0) {
      const si = stockItemMatch(item.productoId, item.color||'', item.talle||'');
      if (si) await guardarDoc('stock', si.id, {...si, cantidad: si.cantidad+(item.cantidad||0)});
      else    await guardarDoc('stock', uid(), { productoId:item.productoId, color:item.color||'', talle:item.talle||'', cantidad:item.cantidad||0 });
    }
  }

  await guardarDoc('gastos', id, gastoData);
  cerrarGastoModal();
}

function editarGasto(id) { abrirGastoModal(_gastos.find(g=>g.id===id)); }

async function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  const g = _gastos.find(x=>x.id===id);
  if (g) {
    for (const item of itemsDeGasto(g)) {
      if (item.categoria==='articulos' && item.productoId && item.cantidad) {
        const si = stockItemMatch(item.productoId, item.color||'', item.talle||'');
        if (si) await guardarDoc('stock', si.id, {...si, cantidad: Math.max(0, si.cantidad-(item.cantidad||0))});
      }
    }
  }
  await eliminarDoc('gastos', id);
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function pesos(n) { if (n===undefined||n===null) return '—'; return '$'+Math.round(n).toLocaleString('es-AR'); }
function fecha(iso) { if (!iso) return '—'; const d=new Date(iso.length===10?iso+'T00:00:00':iso); return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fechaCorta(iso) { if (!iso) return '—'; const d=new Date(iso); return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }
function hoyISO() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function diffDias(iso) { if(!iso) return 9999; return (new Date(iso+'T00:00:00')-new Date())/86400000; }
function numPedido(num) { return parseInt((num||'').replace(/\D/g,''))||0; }
function resumenProductos(p) { return (p.productos||[]).map(pr=>`${pr.cantidad}× ${CATALOGO[pr.productoId]?.nombre||pr.productoId}`).join(', ')||'—'; }
function cobroBadge(p) { if(p.cobro?.saldoPagado) return 'cobro-completo'; if(p.cobro?.senaPagada) return 'cobro-parcial'; return 'cobro-pendiente'; }
function cobroLabel(p) { if(p.cobro?.saldoPagado) return 'Cobrado ✓'; if(p.cobro?.senaPagada) return 'Seña ✓'; return 'Pendiente'; }
function catLabel(cat) { return cat==='articulos'?'🧥 Artículos':cat==='insumos'?'🖨 Insumos':'📦 Otro'; }
function uid()  { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function log(a) { return { fecha: new Date().toISOString(), accion: a }; }

function pedidoCard(p) {
  return `<div class="pedido-card" onclick="abrirDetalle('${p.id}')">
    <div class="pedido-card-top">
      <div><div class="pedido-card-num">${p.numero}</div><div class="pedido-card-nombre">${p.cliente}</div></div>
      <span class="badge badge-${p.estado}">${ESTADOS[p.estado]}</span>
    </div>
    <div class="pedido-card-productos">${resumenProductos(p)}</div>
    <div class="pedido-card-bottom">
      <span class="pedido-card-fecha ${diffDias(p.fechaEntrega)<=2&&!['entregado','cancelado'].includes(p.estado)?'urgente':''}">📅 ${fecha(p.fechaEntrega)}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="cobro-badge ${cobroBadge(p)}">${cobroLabel(p)}</span>
        <span class="pedido-card-monto">${pesos(p.total)}</span>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════
//  EXPONER AL HTML
// ═══════════════════════════════════════════════
Object.assign(window, {
  nav, toggleMas,
  agregarLinea, cambiarLinea, quitarLinea, recalcularLineas,
  guardarPresupuesto, confirmarPedido,
  confirmarPresupuesto, editarPresupuesto, descartarPresupuesto,
  abrirDetalle, cerrarModal, marcarSena, marcarSaldo, cambiarEstado, editarPedido, eliminarPedido,
  abrirStockModal, cerrarStockModal, actualizarCamposStock, guardarStock, editarStock, eliminarStock,
  abrirGastoModal, cerrarGastoModal, agregarItemGasto, cambiarItemGasto, quitarItemGasto, guardarGasto, editarGasto, eliminarGasto,
  setFiltro, setOrden, setBusqueda, setBusquedaArchivo,
});

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', e => { e.preventDefault(); nav(el.dataset.section); })
);
nav('dashboard');

