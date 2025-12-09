let datosExcel = [];
let chart = null;

let statsPorMes = {};
let statsPorDiaPorMes = {};
let mesesOrdenados = [];

// === INICIO === //
document.addEventListener("DOMContentLoaded", () => cargarExcel());

// === CARGAR EXCEL === //
function cargarExcel() {
    fetch("Datos.xlsx")
        .then(r => r.arrayBuffer())
        .then(data => {
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            datosExcel = XLSX.utils.sheet_to_json(ws, { raw: false });

            procesarDatos();
            llenarSelectMeses();
            dibujarGraficoPorMeses();
        });
}

// === PROCESAR DATOS === //
function procesarDatos(){
    statsPorMes = {};
    statsPorDiaPorMes = {};
    const setMeses = new Set();

    datosExcel.forEach(row=>{
        const turno = row["Turno"];
        const f = new Date(row["Fecha"]);
        if(!turno || isNaN(f)) return;

        const ym = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,"0")}`;
        const d = String(f.getDate());

        setMeses.add(ym);

        statsPorMes[ym] ??= {TI:0, T2:0, T3:0};
        statsPorMes[ym][turno]++;

        statsPorDiaPorMes[ym] ??= {};
        statsPorDiaPorMes[ym][d] ??= {TI:0, T2:0, T3:0};
        statsPorDiaPorMes[ym][d][turno]++;
    });

    mesesOrdenados = [...setMeses].sort();
}

// === SELECT FILTER === //
function llenarSelectMeses(){
    const s = document.getElementById("mesFiltro");
    s.innerHTML = `<option value="ALL">TODOS LOS MESES</option>`;

    mesesOrdenados.forEach(ym=>{
        s.innerHTML += `<option value="${ym}">${formateaMes(ym)}</option>`;
    });

    s.onchange = () => {
        if(s.value === "ALL") dibujarGraficoPorMeses();
        else dibujarGraficoPorDias(s.value);
    };
}

function formateaMes(ym){
    const [a,m] = ym.split("-");
    const f = new Date(a,m-1,1);
    return f.toLocaleDateString("es-PE",{month:"long",year:"numeric"});
}

// === GRÁFICO POR MESES === //
function dibujarGraficoPorMeses(){
    crearGrafico(
        mesesOrdenados.map(formateaMes),
        mesesOrdenados.map(m=>statsPorMes[m].TI),
        mesesOrdenados.map(m=>statsPorMes[m].T2),
        mesesOrdenados.map(m=>statsPorMes[m].T3),
        
    );
}

// === GRÁFICO POR DÍAS === //
function dibujarGraficoPorDias(ym){
    const dias = Object.keys(statsPorDiaPorMes[ym]).sort((a,b)=>a-b);
    crearGrafico(
        dias,
        dias.map(d=>statsPorDiaPorMes[ym][d].TI),
        dias.map(d=>statsPorDiaPorMes[ym][d].T2),
        dias.map(d=>statsPorDiaPorMes[ym][d].T3),
        
    );
}

// === GRAFICO === //
function crearGrafico(labels, ti, t2, t3, titulo){
    const ctx = document.getElementById("chartTurno").getContext("2d");
    if(chart) chart.destroy();

    const totTI = ti.reduce((a,b)=>a+b,0);
    const totT2 = t2.reduce((a,b)=>a+b,0);
    const totT3 = t3.reduce((a,b)=>a+b,0);

    const g1 = ctx.createLinearGradient(0,0,0,350);
    g1.addColorStop(0,"rgba(231,29,54,0.3)");
    g1.addColorStop(1,"rgba(231,29,54,0)");

    const g2 = ctx.createLinearGradient(0,0,0,350);
    g2.addColorStop(0,"rgba(36,123,160,0.3)");
    g2.addColorStop(1,"rgba(36,123,160,0)");

    const g3 = ctx.createLinearGradient(0,0,0,350);
    g3.addColorStop(0,"rgba(155,93,229,0.3)");
    g3.addColorStop(1,"rgba(155,93,229,0)");

    chart = new Chart(ctx,{
        type:"line",
        data:{
            labels,
            datasets:[
                {label:`TI (${totTI})`, data:ti, borderColor:"#E71D36", pointBackgroundColor:"#E71D36",
                 borderWidth:4, tension:0.45, fill:true, backgroundColor:g1},
                {label:`T2 (${totT2})`, data:t2, borderColor:"#247BA0", pointBackgroundColor:"#247BA0",
                 borderWidth:4, tension:0.45, fill:true, backgroundColor:g2},
                {label:`T3 (${totT3})`, data:t3, borderColor:"#9B5DE5", pointBackgroundColor:"#9B5DE5",
                 borderWidth:4, tension:0.45, fill:true, backgroundColor:g3}
            ]
        },
        plugins:[dataLabels],
        options:{
            animation:{ duration:1000 },
            plugins:{
                title:{ display:true, text:titulo, color:"#51613A",
                        font:{size:18,weight:"bold"}, padding:5 },
                legend:{ labels:{ font:{weight:"bold"} } }
            },
            layout:{ padding:{top:0,bottom:0}},
            scales:{
                x:{ ticks:{ color:"#000", font:{weight:"bold"} }},
                y:{ beginAtZero:true, ticks:{color:"#000",font:{weight:"bold"},precision:0}}
            }
        }
    });
}

// === ETIQUETAS === //
const dataLabels = {
    id:"dataLabels",
    afterDatasetsDraw(chart){
        const {ctx} = chart;
        ctx.font="bold 11px Segoe UI";
        ctx.textAlign="center";
        ctx.fillStyle="#000";
        chart.data.datasets.forEach((ds,di)=>{
            chart.getDatasetMeta(di).data.forEach((pt,i)=>{
                const v = ds.data[i];
                if(v>0) ctx.fillText(v, pt.x, pt.y - 10);
            });
        });
    }
};
// === EXPORTAR TODO EL DASHBOARD A PNG === //
document.getElementById("btnPNG").addEventListener("click", () => {
    html2canvas(document.body).then(canvas => {
        const link = document.createElement("a");
        link.download = `Dashboard_${new Date().toLocaleDateString()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
});

// === EXPORTAR TODO EL DASHBOARD A PDF === //
document.getElementById("btnPDF").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;

    html2canvas(document.body).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("landscape");
        const imgProps = pdf.getImageProperties(imgData);

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Dashboard_${new Date().toLocaleDateString()}.pdf`);
    });
});
