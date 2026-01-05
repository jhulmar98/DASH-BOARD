// ===============================
// REGISTRO PLUGINS
// ===============================
Chart.register(ChartDataLabels);
Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio, 2);

// ===============================
// VARIABLES GLOBALES
// ===============================
let rawData = [];
let supervisors = [];
let localesRanking = [];
let allDates = [];
let currentMonth = "Todos";

let chartRanking = null;
let chartLocales = null;
let chartEvolucion = null;

// ===============================
// INICIO
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  btnPng.onclick = exportPNG;
  btnPdf.onclick = exportPDF;

  selectMes.onchange = e => {
    currentMonth = e.target.value;
    procesarData(rawData);
    renderCharts();
  };

  cargarExcel();
});

// ===============================
// CARGAR EXCEL
// ===============================
function cargarExcel() {
  fetch("../datos/locales.xlsx")
    .then(r => r.arrayBuffer())
    .then(buf => {
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      cargarSelectMes(rawData);
      procesarData(rawData);
      renderCharts();
    });
}

// ===============================
// PROCESAR DATA
// ===============================
function procesarData(rows) {

  const supCnt = {};
  const sectorCnt = {};
  const dailyCnt = {};
  const localCnt = {};
  const dateSet = new Set();

  rows.forEach(r => {

    const sup = String(r["Supervisor"] || "").trim();
    if (!sup) return;

    const fecha = normalizarFecha(r["Fecha"]);
    if (!fecha || !filtrarMes(fecha)) return;

    const sector = normalizarSector(r["Sector"]);

    const idLocal = String(r["ID Local"] || "").trim();
    const nombreLocal = String(r["Nombre"] || "SIN NOMBRE").trim();
    if (!idLocal) return;

    const keyLocal = `${idLocal} – ${nombreLocal}`;

    supCnt[sup] = (supCnt[sup] || 0) + 1;

    if (!sectorCnt[sup]) sectorCnt[sup] = {};
    sectorCnt[sup][sector] = (sectorCnt[sup][sector] || 0) + 1;

    if (!dailyCnt[sup]) dailyCnt[sup] = {};
    dailyCnt[sup][fecha] = (dailyCnt[sup][fecha] || 0) + 1;
    dateSet.add(fecha);

    localCnt[keyLocal] = (localCnt[keyLocal] || 0) + 1;
  });

  supervisors = Object.entries(supCnt)
    .map(([nombre, total]) => ({
      nombre,
      total,
      sectores: sectorCnt[nombre] || {},
      diario: dailyCnt[nombre] || {}
    }))
    .sort((a,b) => b.total - a.total);

  localesRanking = Object.entries(localCnt)
    .map(([local, total]) => ({ local, total }))
    .sort((a,b) => b.total - a.total);

  allDates = Array.from(dateSet).sort();

  cargarSelectSupervisor();
}

// ===============================
// FILTROS
// ===============================
function filtrarMes(f) {
  return currentMonth === "Todos" || f.split("-")[1] === currentMonth;
}

function cargarSelectMes(rows) {
  const meses = new Set();
  rows.forEach(r => {
    const f = normalizarFecha(r["Fecha"]);
    if (f) meses.add(f.split("-")[1]);
  });

  selectMes.innerHTML = `<option value="Todos">Todos</option>`;
  [...meses].sort().forEach(m => {
    selectMes.innerHTML += `<option value="${m}">${nombreMes(m)}</option>`;
  });
}

function cargarSelectSupervisor() {
  supervisorSelect.innerHTML = `<option value="ALL">Todos los supervisores</option>`;
  supervisors.forEach(s => {
    supervisorSelect.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`;
  });

  supervisorSelect.onchange = () => renderEvolucion(supervisorSelect.value);
}

// ===============================
// NORMALIZADORES
// ===============================
function normalizarFecha(f) {
  if (!f) return "";
  if (f instanceof Date) return f.toISOString().split("T")[0];
  const p = String(f).split("/");
  return p.length === 3
    ? `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`
    : "";
}

function normalizarSector(s="") {
  const t = s.toLowerCase();
  if (t.includes("01")) return "Sector 01";
  if (t.includes("02")) return "Sector 02";
  if (t.includes("03")) return "Sector 03";
  if (t.includes("04")) return "Sector 04";
  if (t.includes("05")) return "Sector 05";
  if (t.includes("fz")) return "FZ";
  return "Otros";
}

function nombreMes(m) {
  return ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
          "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][+m];
}

// ===============================
// COLORES
// ===============================
function coloresRanking(len) {
  return Array.from({length: len}, (_, i) =>
    i === 0 ? "#8C4A2F" : i < 3 ? "#C9B458" : "#6F7F45"
  );
}

// ===============================
// RENDER GENERAL
// ===============================
function renderCharts() {
  chartRanking?.destroy();
  chartLocales?.destroy();
  chartEvolucion?.destroy();

  renderRankingSupervisores();
  renderRankingLocales();
  renderTablaSectores();
  renderEvolucion("ALL");
}

// ===============================
// RANKING SUPERVISORES
// ===============================
function renderRankingSupervisores() {
  chartRanking = new Chart(chartRankingCanvas,{
    type:"bar",
    data:{
      labels: supervisors.map(s=>s.nombre),
      datasets:[{
        data: supervisors.map(s=>s.total),
        backgroundColor: coloresRanking(supervisors.length),
        categoryPercentage: 0.7,
        barPercentage: 0.6
      }]
    },
    options:{
      indexAxis:"y",
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        datalabels:{
          anchor:"end",
          align:"right",
          formatter:v=>v
        }
      },
      scales:{
        y:{ ticks:{ autoSkip:false } }
      }
    }
  });
}

// ===============================
// RANKING LOCALES
// ===============================
function renderRankingLocales() {
  chartLocales = new Chart(chartLocalesCanvas,{
    type:"bar",
    data:{
      labels: localesRanking.map(l=>l.local),
      datasets:[{
        data: localesRanking.map(l=>l.total),
        backgroundColor: coloresRanking(localesRanking.length),
        categoryPercentage: 0.7,
        barPercentage: 0.6
      }]
    },
    options:{
      indexAxis:"y",
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        datalabels:{
          anchor:"end",
          align:"right",
          formatter:v=>v
        }
      },
      scales:{
        y:{ ticks:{ autoSkip:false } }
      }
    }
  });
}

// ===============================
// TABLA SECTORES
// ===============================
function renderTablaSectores() {
  const sectores = ["Sector 01","Sector 02","Sector 03","Sector 04","Sector 05","FZ"];
  let html = `<table class="tabla-sectores"><thead><tr><th>Supervisor</th>`;
  sectores.forEach(s=>html+=`<th>${s}</th>`);
  html+=`</tr></thead><tbody>`;

  supervisors.forEach(s=>{
    html+=`<tr><td>${s.nombre}</td>`;
    sectores.forEach(sec=>html+=`<td>${s.sectores[sec]||0}</td>`);
    html+=`</tr>`;
  });

  html+=`</tbody></table>`;
  sectorTableContainer.innerHTML = html;
}

// ===============================
// EVOLUCIÓN
// ===============================
function renderEvolucion(nombre) {

  chartEvolucion?.destroy();

  chartEvolucion = new Chart(chartEvolucionCanvas,{
    type:"line",
    data:{
      labels: allDates,
      datasets:[{
        label: nombre === "ALL"
          ? "Todos los supervisores"
          : nombre,

        data: allDates.map(d =>
          nombre === "ALL"
            ? supervisors.reduce((a,s)=>a + (s.diario[d] || 0), 0)
            : supervisors.find(x => x.nombre === nombre)?.diario[d] || 0
        ),

        borderColor:"#55633A",
        backgroundColor:"rgba(85,99,58,.25)",
        fill:true,
        tension:.35,
        pointRadius:4,
        pointHoverRadius:6
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ display:true },

        // 🔥 ETIQUETAS EN CADA PUNTO
        datalabels:{
          display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
          color:"#2f3b1f",
          align:"top",
          anchor:"end",
          offset:6,
          font:{
            weight:"bold",
            size:11
          },
          formatter: v => v
        }
      }
    }
  });
}


// ===============================
// EXPORTAR
// ===============================
function exportPNG(){
  html2canvas(document.body,{scale:2}).then(c=>{
    const a=document.createElement("a");
    a.href=c.toDataURL("image/png");
    a.download="Supervisor_Locales.png";
    a.click();
  });
}

function exportPDF(){
  html2canvas(document.body,{scale:2}).then(c=>{
    const pdf=new jspdf.jsPDF("p","mm","a4");
    pdf.addImage(c.toDataURL("image/png"),"PNG",0,0,210,297);
    pdf.save("Supervisor_Locales.pdf");
  });
}
