// =====================================
//  CONFIG INICIAL
// =====================================
Chart.register(ChartDataLabels);

let rawData = [];
let supervisors = [];
let cargos = [];
let allDates = [];
let currentMonth = "Todos";

let chartRanking = null;
let chartCargos = null;
let chartSector = null;
let chartEvolucion = null;

// =====================================
//  INICIO
// =====================================
window.addEventListener("DOMContentLoaded", () => {
    const btnPng  = document.getElementById("btnPng");
    const btnPdf  = document.getElementById("btnPdf");
    const selMes  = document.getElementById("selectMes");

    if (btnPng) btnPng.addEventListener("click", exportPNG);
    if (btnPdf) btnPdf.addEventListener("click", exportPDF);
    if (selMes) {
        selMes.addEventListener("change", () => {
            currentMonth = selMes.value;
            processData(rawData);
            buildCharts();
        });
    }

    loadExcel();
});

// =====================================
//  CARGA EXCEL
// =====================================
function loadExcel() {
    fetch("./Datos.xlsx")
        .then(r => r.arrayBuffer())
        .then(buf => {
            const wb = XLSX.read(buf, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            loadMonthSelect(rawData);
            processData(rawData);
            buildCharts();
        })
        .catch(err => console.error("Error cargando Excel:", err));
}

// =====================================
//  PROCESAR SEGÚN MES
// =====================================
function processData(rows) {
    const supCnt   = {};
    const supNames = {};
    const cargCnt  = {};
    const secCnt   = {};
    const dailyCnt = {};
    const dateSet  = new Set();

    rows.forEach(r => {
        const dni = String(r["Supervisor DNI"] || "").trim();
        if (!dni) return;

        const fechaNorm = normalizeDate(r["Fecha"]);
        if (!fechaNorm) return;

        if (!filterByMonth(fechaNorm)) return;

        const nombreSup = String(r["Supervisor"] || "");
        const cargo     = String(r["Cargo"] || "");
        const sector    = normalizeSector(r["sector"]);

        supCnt[dni] = (supCnt[dni] || 0) + 1;
        supNames[dni] = nombreSup;

        cargCnt[cargo] = (cargCnt[cargo] || 0) + 1;

        if (!secCnt[dni]) secCnt[dni] = {};
        secCnt[dni][sector] = (secCnt[dni][sector] || 0) + 1;

        dateSet.add(fechaNorm);
        if (!dailyCnt[dni]) dailyCnt[dni] = {};
        dailyCnt[dni][fechaNorm] = (dailyCnt[dni][fechaNorm] || 0) + 1;
    });

    supervisors = Object.entries(supCnt)
        .map(([dni, total]) => ({
            dni,
            nombre: supNames[dni],
            total,
            sectorCounts: secCnt[dni] || {},
            daily: dailyCnt[dni] || {}
        }))
        .sort((a, b) => b.total - a.total);

    cargos = Object.entries(cargCnt)
        .map(([cargo, total]) => ({ cargo, total }))
        .sort((a, b) => b.total - a.total);

    allDates = Array.from(dateSet).sort();

    loadSupervisorSelect();
}

// =====================================
//  FILTRO MES
// =====================================
function filterByMonth(f) {
    if (currentMonth === "Todos") return true;
    return f.split("-")[1] === currentMonth;
}

// =====================================
//  SELECT MESES
// =====================================
function loadMonthSelect(rows) {
    const sel = document.getElementById("selectMes");
    if (!sel) return;

    const months = new Set();

    rows.forEach(r => {
        const f = normalizeDate(r["Fecha"]);
        if (!f) return;
        months.add(f.split("-")[1]);
    });

    sel.innerHTML = `<option value="Todos">Todos</option>`;

    Array.from(months).sort().forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = getMonthName(m);
        sel.appendChild(opt);
    });
}

function getMonthName(m) {
    const n = parseInt(m);
    const nombres = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return nombres[n] || m;
}

// =====================================
//  NORMALIZAR FORMATO FECHA
// =====================================
function normalizeDate(f) {
    if (!f) return "";

    if (typeof f === "number") {
        const base = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(base.getTime() + f * 86400000);
        return date.toISOString().split("T")[0];
    }

    if (f instanceof Date) {
        return f.toISOString().split("T")[0];
    }

    const p = String(f).split("/");
    if (p.length === 3) {
        const d = p[0].padStart(2, "0");
        const m = p[1].padStart(2, "0");
        const y = p[2];
        return `${y}-${m}-${d}`;
    }

    return "";
}

// =====================================
//  NORMALIZAR SECTOR
// =====================================
function normalizeSector(s = "") {
    const t = s.toLowerCase();
    if (t.includes("01")) return "Sector 01";
    if (t.includes("02")) return "Sector 02";
    if (t.includes("03")) return "Sector 03";
    if (t.includes("04")) return "Sector 04";
    if (t.includes("05")) return "Sector 05";
    if (t.includes("fz") || t.includes("fuera")) return "FZ";
    return "Otros";
}

// =====================================
//  GRÁFICOS
// =====================================
function buildCharts() {
    destroyCharts();
    rankingChart();
    cargosChart();
    sectorChart();

    const sel = document.getElementById("supervisorSelect");
    if (sel) sel.value = "ALL";

    evolucionChart("ALL");
}

function destroyCharts() {
    chartRanking?.destroy();
    chartCargos?.destroy();
    chartSector?.destroy();
    chartEvolucion?.destroy();
}

/* 1️⃣ Ranking Supervisores */

function rankingChart() {
    const labels = supervisors.map((s, i) => `${s.nombre} ${i + 1}`);
    const values = supervisors.map(s => s.total);

    const canvas = document.getElementById("chartRanking");
    canvas.style.height = (labels.length * 32) + "px";

    const max = Math.max(...values);
    const min = Math.min(...values);

    // Gradiente invertido: verde -> dorado -> marrón
    function colorEscala(v) {
        const t = (v - min) / (max - min);

        const colores = [
            [67, 82, 42],   // Verde oscuro (peor)
            [126, 148, 76], // Verde oliva
            [201, 180, 88], // Dorado
            [143, 80, 50]   // Marrón fuerte (mejor)
        ];

        const i = Math.floor(t * (colores.length - 1));
        const p = (t * (colores.length - 1)) % 1;

        const c1 = colores[i];
        const c2 = colores[i + 1] || colores[i];

        const r = Math.round(c1[0] + (c2[0] - c1[0]) * p);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * p);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * p);

        return `rgb(${r},${g},${b})`;
    }

    const colors = values.map(colorEscala);

    chartRanking = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#ffffffAA",
                borderWidth: 1.3
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end",
                    align: "right",
                    color: "#222",
                    font: { weight: "bold", size: 12 },
                    formatter: v => v.toLocaleString()
                }
            },
            layout: { padding: { right: 14 } },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: "#ddd3" }
                },
                y: { grid: { display: false } }
            }
        }
    });
}


/* 2️⃣ Ranking Cargos */
/* 2️⃣ Ranking Cargos - MEJORA DE ETIQUETAS + CENTRADO + 3 LÍNEAS */
/* 2️⃣ Ranking Cargos - Sin Desbordes + Líneas Dinámicas + Diseño PRO */
function cargosChart() {

    const values = cargos.map(c => c.total);
    const max = Math.max(...values);

    const colors = values.map(v => {
        const p = v / max;
        if (p > 0.85) return "#8F5032";
        if (p > 0.65) return "#B0763B";
        if (p > 0.45) return "#C9B458";
        if (p > 0.25) return "#8A9848";
        return "#51613A";
    });

    const labels = cargos.map(({ cargo }) => {
        const words = cargo.split(" ");
        const lines = [];
        let current = "";

        words.forEach(w => {
            if ((current + " " + w).trim().length <= 26) {
                current += " " + w;
            } else {
                lines.push(current.trim());
                current = w;
            }
        });

        if (current.trim()) lines.push(current.trim());
        return lines.slice(0, 3);
    });

    const canvas = document.getElementById("chartCargos");
    canvas.style.height = (labels.length * 42) + "px";

    chartCargos?.destroy();

    chartCargos = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#2F2F2F",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 40 }}, // espacio extra anti-desborde
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: "#ddd" },
                    ticks: {
                        color: "#555",
                        font: { size: 10 }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: "#222",
                        font: { size: 9, weight: "bold" },
                        maxRotation: 0,
                        padding: 5
                    }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end",
                    align: "right",
                    clamp: true,
                    clip: false,
                    padding: { right: 6 },
                    color: "#000",
                    formatter: v => v.toLocaleString(),
                    font: ctx => {
                        const labelLines = ctx.chart.data.labels[ctx.dataIndex];
                        return { size: labelLines.length === 1 ? 11 : 9, weight: "bold" };
                    }
                }
            }
        }
    });
}



/* 3️⃣ Sector x Supervisor */

function sectorChart() {
    const container = document.getElementById("sectorTableContainer");
    if (!container) return;
    container.innerHTML = ""; // limpiar

    const sectores = ["Sector 01", "Sector 02", "Sector 03", "Sector 04", "Sector 05", "FZ"];

    // Crear tabla
    let html = `
    <table class="tabla-sectores">
        <thead>
            <tr>
                <th>Supervisor</th>
                ${sectores.map(s => `<th>${s}</th>`).join("")}
            </tr>
        </thead>
        <tbody>`;

    supervisors.forEach(s => {
        html += `
        <tr>
            <td>${s.nombre}</td>
            ${sectores.map(sec => `<td>${s.sectorCounts[sec] || 0}</td>`).join("")}
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}


/* 4️⃣ Evolución diaria */
function evolucionChart(dni) {
    const canvas = document.getElementById("chartEvolucion");
    canvas.style.height = "420px";

    chartEvolucion?.destroy();

    const labels = allDates;
    let values = [];
    let labelLinea = "";

    if (dni === "ALL") {
        labelLinea = "Todos los supervisores";
        values = labels.map(d =>
            supervisors.reduce((sum, s) => sum + (s.daily[d] || 0), 0)
        );
    } else {
        const s = supervisors.find(x => x.dni === dni) || supervisors[0];
        labelLinea = s.nombre;
        values = labels.map(d => (s.daily[d] || 0));
    }

    chartEvolucion = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: labelLinea,
                data: values,
                borderColor: "#51613A",
                backgroundColor: "rgba(81,97,58,.3)",
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: "#51613A"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                datalabels: {
                    anchor: "end",
                    align: "top",
                    color: "#333",
                    font: { weight: "bold", size: 10 },
                    formatter: v => v > 0 ? v : ""
                }
            },
            scales: {
                x: { ticks: { color: "#555" } },
                y: { beginAtZero: true, ticks: { color: "#555" } }
            }
        }
    });
}

/* SELECT Supervisor */
function loadSupervisorSelect() {
    const sel = document.getElementById("supervisorSelect");
    if (!sel) return;

    sel.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "ALL";
    optAll.textContent = "Todos los supervisores";
    sel.appendChild(optAll);

    supervisors.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.dni;
        opt.textContent = s.nombre;
        sel.appendChild(opt);
    });

    sel.onchange = () => evolucionChart(sel.value);
}

// =====================================
//  EXPORTAR
// =====================================
// =====================================
//  EXPORTAR - PNG & PDF SIN CORTES + LOADING
// =====================================
function exportPNG() {
    const dashboard = document.body;
    const loading = document.getElementById("exportLoading");
    loading.style.display = "block";

    window.scrollTo(0, 0);

    html2canvas(dashboard, {
        scale: 3,
        useCORS: true,
        scrollY: -window.scrollY,
        height: dashboard.scrollHeight,
        windowHeight: dashboard.scrollHeight,
    }).then(canvas => {
        loading.style.display = "none";
        const link = document.createElement("a");
        link.download = "dashboard.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    }).catch(() => loading.style.display = "none");
}

function exportPDF() {
    const dashboard = document.body;
    const loading = document.getElementById("exportLoading");
    loading.style.display = "block";

    window.scrollTo(0, 0);

    html2canvas(dashboard, {
        scale: 3,
        useCORS: true,
        scrollY: -window.scrollY,
        height: dashboard.scrollHeight,
        windowHeight: dashboard.scrollHeight,
    }).then(canvas => {
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const pdf = new jspdf.jsPDF("p", "mm", "a4");

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = imgWidth * canvas.height / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save("dashboard.pdf");
        loading.style.display = "none";
    }).catch(() => loading.style.display = "none");
}
