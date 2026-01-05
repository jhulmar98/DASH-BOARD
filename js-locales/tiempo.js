// =============================
// REGISTRO PLUGINS
// =============================
Chart.register(ChartDataLabels);

let charts = {};
let datosExcel = [];

// =============================
// COLUMNAS EXCEL LOCALES
// =============================
const COL_FECHA  = "Fecha";
const COL_HORA   = "Hora";
const COL_SECTOR = "Sector";

// =============================
// 📌 CARGA AUTOMÁTICA DEL EXCEL
// =============================
fetch("../datos/locales.xlsx")
  .then(res => res.arrayBuffer())
  .then(buffer => {
    const wb   = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(
      wb.Sheets[wb.SheetNames[0]],
      { defval:"" }
    );
    procesarExcel(rows);
  })
  .catch(() => mostrarError("No se pudo cargar locales.xlsx"));

function mostrarError(msg){
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.classList.remove("hidden");
}

// =============================
// 📌 PROCESAMIENTO EXCEL
// =============================
function procesarExcel(rows) {

  datosExcel = rows.map(r => {

    let fecha =
      (r[COL_FECHA] instanceof Date)
        ? normalizarFechaExcel(r[COL_FECHA])
        : excelDateToJSDate(r[COL_FECHA]);

    if (!fecha) return null;

    const mes       = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}`;
    const diaMes    = fecha.getDate();
    const diaSemana = diaSemanaLunesADomingo(fecha);
    const hora      = extraerHora(r[COL_HORA]);

    let sectorTxt = String(r[COL_SECTOR] || "").toLowerCase();
    let match     = sectorTxt.match(/\d+/);
    let sector    = match ? parseInt(match[0]) : 6;

    if (sector < 1 || sector > 6) sector = 6;

    return { mes, diaMes, diaSemana, hora, sector };

  }).filter(Boolean);

  cargarMeses();
}

// =============================
// 📌 FECHAS & HORAS
// =============================
function normalizarFechaExcel(fecha) {
  if (!(fecha instanceof Date)) return null;
  const d = new Date(fecha.getTime() + fecha.getTimezoneOffset()*60000);
  d.setHours(0,0,0,0);
  return d;
}

function excelDateToJSDate(serial) {
  if (!serial) return null;
  return normalizarFechaExcel(
    new Date((serial - 25569) * 86400 * 1000)
  );
}

function extraerHora(valor) {
  if (valor === null || valor === undefined) return 0;

  if (typeof valor === "number") {
    return Math.floor((valor * 24) % 24);
  }

  if (valor instanceof Date) {
    return valor.getHours();
  }

  let match = valor.toString().match(/(\d{1,2})/);
  if (match) {
    let h = parseInt(match[1]);
    if (h >= 0 && h < 24) return h;
  }

  return 0;
}

const diaSemanaLunesADomingo = f => (f.getDay() + 6) % 7;

// =============================
// 📌 SELECT DE MESES
// =============================
const selectMes = document.getElementById("selectMes");
selectMes.addEventListener("change", actualizarDashboard);

function cargarMeses() {
  const meses = [...new Set(datosExcel.map(d => d.mes))].sort();
  selectMes.innerHTML = "";
  meses.forEach(m => selectMes.appendChild(new Option(m, m)));

  if (meses.length) {
    selectMes.value = meses.at(-1);
    actualizarDashboard();
  }
}

function actualizarDashboard() {
  const mes = selectMes.value;
  dibujar(datosExcel.filter(d => d.mes === mes));
}

// =============================
// 📊 DIBUJAR GRÁFICOS
// =============================
function dibujar(datos) {
  if (!datos.length) return;

  const minDia = Math.min(...datos.map(x=>x.diaMes));
  const maxDia = Math.max(...datos.map(x=>x.diaMes));

  let dm  = Array(maxDia-minDia+1).fill(0);
  let ds  = Array(7).fill(0);
  let sec = Array(6).fill(0);
  let hr  = Array(24).fill(0);

  datos.forEach(x=>{
    dm[x.diaMes-minDia]++;
    ds[x.diaSemana]++;
    sec[x.sector-1]++;
    hr[x.hora]++;
  });

  renderChart("chartDiaMes", dm, "totalDiaMes",
    dm.map((_,i)=>minDia+i), "line");

  renderChart("chartDiaSemana", ds, null,
    ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"], "bar");

  renderChart("chartSector", sec, null,
    ["S1","S2","S3","S4","S5","FZ"], "bar");

  renderChart("chartHorario", hr, null,
    Array.from({length:24},(_,i)=>String(i).padStart(2,"0")), "bar");
}

// =============================
// 🎨 RENDER GENÉRICO
// =============================
function renderChart(id, data, totalId, labels, tipo) {
  if (charts[id]) charts[id].destroy();

  const max   = Math.max(...data);
  const total = data.reduce((a,b)=>a+b,0);

  const colors = data.map(v =>
    v === max      ? "#8F5032" :
    v > max * 0.5  ? "#C9B458" :
                     "#6A7B47"
  );

  charts[id] = new Chart(document.getElementById(id), {
    type: tipo,
    data: {
      labels,
      datasets: [{
        label: id === "chartDiaMes"
          ? `Total mes: ${total.toLocaleString()}`
          : "Escaneos",
        data,
        backgroundColor: colors,
        borderColor:"#4C5933",
        borderWidth:2,
        tension:0.35,
        fill: tipo==="line",
        pointRadius: tipo==="line" ? 5 : 0,
        pointBackgroundColor:"#4C5933"
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{ padding:{ top:20 }},
      scales:{ y:{ beginAtZero:true }},
      plugins:{
        legend:{
          display: id === "chartDiaMes",
          position:"bottom"
        },
        datalabels:{
          color:"#111",
          font:{ weight:"bold", size:11 },
          anchor:"end",
          align:"top",
          formatter:v=>v||""
        }
      }
    }
  });

  if (totalId) {
    const span = document.getElementById(totalId);
    if (span) span.textContent = total.toLocaleString();
  }
}

// =============================
// 🖼️ EXPORTAR PNG / PDF
// =============================
const btnPNG = document.getElementById("btnPNG");
const btnPDF = document.getElementById("btnPDF");
const dashboard = document.body;

if (btnPNG) {
  btnPNG.addEventListener("click", () => {
    html2canvas(dashboard, { scale: 2 }).then(canvas => {
      const link = document.createElement("a");
      link.download = `locales_${selectMes.value || "mes"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });
}

if (btnPDF) {
  btnPDF.addEventListener("click", () => {
    html2canvas(dashboard, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p","mm","a4");

      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth  = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData,"PNG",0,position,imgWidth,imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData,"PNG",0,position,imgWidth,imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`locales_${selectMes.value || "mes"}.pdf`);
    });
  });
}
