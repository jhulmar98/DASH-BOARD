Chart.register(ChartDataLabels);
Chart.defaults.devicePixelRatio = Math.min(window.devicePixelRatio, 2);

fetch("../datos/locales.xlsx")
  .then(res => res.arrayBuffer())
  .then(buffer => {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

    const headers = (data[0] || []).map(h => (h ?? "").toString().trim());

    const fechaIndex  = headers.indexOf("Fecha");
    const sectorIndex = headers.indexOf("Sector"); // 👈 en LOCALES es "Sector" (S mayúscula)

    if (fechaIndex === -1) throw new Error("No se encontró la columna 'Fecha' en locales.xlsx");
    if (sectorIndex === -1) throw new Error("No se encontró la columna 'Sector' en locales.xlsx");

    const ordenMeses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const nombresMesCompleto = {
      ene:"Enero", feb:"Febrero", mar:"Marzo", abr:"Abril", may:"Mayo", jun:"Junio",
      jul:"Julio", ago:"Agosto", sep:"Septiembre", oct:"Octubre", nov:"Noviembre", dic:"Diciembre"
    };

    const conteoMes = {};
    const conteoSector = {
      "Sector 01": 0,
      "Sector 02": 0,
      "Sector 03": 0,
      "Sector 04": 0,
      "Sector 05": 0,
      "FZ": 0
    };

    // Mes seguro (no depende de "oct." vs "oct")
    const mesKey = (d) => ordenMeses[d.getMonth()];

    data.slice(1).forEach(row => {
      const fecha = row[fechaIndex];
      const rawSector = (row[sectorIndex] ?? "").toString();

      // ---- SECTOR (01-05 o FZ) ----
      const low = rawSector.toLowerCase();

      // Si viene "Fuera de zona" o algo similar -> FZ
      let sectorFinal = "FZ";

      if (!low.includes("fuera")) {
        // soporta: "Sector 04", "04", "4", "SECTOR-2", etc.
        let digits = low
          .replace(/\s+/g, "")
          .replace("sector", "")
          .replace(/[^0-9]/g, "");

        let s = (digits || "").padStart(2, "0");
        if (s >= "01" && s <= "05") sectorFinal = `Sector ${s}`;
      }

      if (sectorFinal === "FZ") conteoSector["FZ"]++;
      else conteoSector[sectorFinal]++;

      // ---- MES ----
      if (fecha instanceof Date && !isNaN(fecha)) {
        const mk = mesKey(fecha);
        conteoMes[mk] = (conteoMes[mk] || 0) + 1;
      }
    });

    const mesesOrdenados = ordenMeses.filter(m => conteoMes[m]);
    const valores = mesesOrdenados.map(m => conteoMes[m]);
    const total = valores.reduce((a,b)=>a+b,0) || 1;
    const porcentajes = valores.map(v => ((v/total)*100).toFixed(1));

    renderPie(mesesOrdenados, valores, porcentajes, nombresMesCompleto);
    renderLinea(mesesOrdenados, valores, total, nombresMesCompleto);
    renderSectorBars(conteoSector);
  });


// 🥧 PIE
function renderPie(meses, valores, porcentajes, nombresMesCompleto) {

  const colores = ["#C9B458","#6A7B47","#C75D2C","#4C5933","#9A7F4D","#8F5032"];

  // ✅ Leyenda: COLOR + MES + CANTIDAD
  const legendContainer = document.querySelector(".legendBox");
  legendContainer.innerHTML = meses.map((m, i) =>
    `<div class="legendItem">
      <span class="legendColor" style="background:${colores[i % colores.length]}"></span>
      <strong>${nombresMesCompleto[m]}</strong> — ${valores[i].toLocaleString()}
    </div>`
  ).join("");

  new Chart(graficoTorta, {
    type: "pie",
    data: {
      labels: meses.map((m, i) => `${porcentajes[i]}%`),
      datasets: [{
        data: valores,
        backgroundColor: meses.map((_, i) => colores[i % colores.length]),
        borderColor: "#fff",
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 15 },
          formatter: (v, ctx) => `${porcentajes[ctx.dataIndex]}%`
        }
      }
    }
  });
}


// 📈 LINEA
function renderLinea(meses, valores, total, nombresMesCompleto) {
  new Chart(graficoLinea, {
    type: "line",
    data: {
      labels: meses.map(m => nombresMesCompleto[m]),
      datasets: [{
        label: `Total: ${total.toLocaleString()}`,
        data: valores,
        borderColor: "#51613A",
        backgroundColor: "rgba(81,97,58,0.25)",
        tension: 0.4,
        pointRadius: 7,
        pointBackgroundColor: "#51613A",
        pointBorderColor: "#fff",
        pointBorderWidth: 2
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        datalabels: {
          anchor: "end",
          align: "top",
          backgroundColor: "#fff",
          color: "#111",
          borderColor: "#51613A",
          borderWidth: 1,
          padding: 4,
          borderRadius: 4,
          formatter: (v) => v.toLocaleString(),
          clip: false
        },
        tooltip: { enabled: false }
      },
      scales: {
        x: { offset: true },
        y: { beginAtZero: true, grace: "15%" }
      }
    }
  });
}


// 📊 SECTOR
function renderSectorBars(conteoSector) {
  new Chart(graficoSector, {
    type: "bar",
    data: {
      labels: Object.keys(conteoSector),
      datasets: [{
        data: Object.values(conteoSector),
        backgroundColor: ["#6A7B47","#8F5032","#C9B458","#4C5933","#C75D2C","#9A7F4D"]
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          anchor: "end",
          align: "end",
          color: "#000",
          font: { weight: "bold", size: 14 },
          formatter: v => v.toLocaleString(),
          clip: false
        }
      },
      scales: {
        y: { beginAtZero: true, grace: "10%" }
      }
    }
  });
}


// 📌 CAPTURAR TODA LA PÁGINA EN PNG
document.getElementById("btnPNG").addEventListener("click", () => {
  html2canvas(document.body, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.download = "Reporte-General-Locales.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
});


// 📌 EXPORTAR PDF EN HOJA A4 VERTICAL
document.getElementById("btnPDF").addEventListener("click", () => {
  html2canvas(document.body, { scale: 2 }).then(canvas => {

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jspdf.jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let y = 0;

      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        y = heightLeft - imgHeight;
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save("Reporte-General-Locales.pdf");
  });
});
