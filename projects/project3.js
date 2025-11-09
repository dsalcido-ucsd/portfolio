import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import * as topojson from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

(async function () {
  // ---- DOM refs
  const mapSvg = d3.select("#map");
  const mapW = +mapSvg.attr("width");
  const mapH = +mapSvg.attr("height");

  const yearsAfterEl = d3.select("#yearsAfter");
  const yearsAfterValueEl = d3.select("#yearsAfterValue");
  const countrySearchEl = d3.select("#countrySearch");
  const clearSelectionBtn = d3.select("#clearSelection");

  // ---- Load data (added componentsRows)
  const [world, peakStatus, oadrRows, componentsRows] = await Promise.all([
    // Use CDN for world topology to avoid missing local file issues
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    d3.csv("./data/peak_status.csv", d => ({ id: +d.id, status: d.status, peak_year: +d.peak_year })),
    d3.csv("./data/oadr_peaks.csv", d => ({
      id: +d.id,
      oadr_peak: +d.oadr_peak,
      oadr_p10: +d.oadr_p10,
      oadr_p15: +d.oadr_p15,
      oadr_p20: +d.oadr_p20,
      oadr_p25: +d.oadr_p25,
      oadr_p30: +d.oadr_p30
    })),
    d3.csv("./data/components_decades.csv", d => ({
      id: +d.id,
      decade_start: +d.decade_start,
      births: +d.births,
      deaths: +d.deaths,
      natural_increase: +d.natural_increase,
      net_migration: +d.net_migration,
      total_change: +d.total_change,
      rate_natural_per_1k: +d.rate_natural_per_1k,
      rate_migration_per_1k: +d.rate_migration_per_1k,
      rate_total_per_1k: +d.rate_total_per_1k
    }))
  ]);

  const countries = topojson.feature(world, world.objects.countries).features;

  // ---- Indexes
  const statusById = new Map(peakStatus.map(d => [d.id, d]));
  const oadrById   = new Map(oadrRows.map(d => [d.id, d]));

  // ---- Map setup
  const projection = d3.geoNaturalEarth1().fitSize([mapW, mapH], { type: "Sphere" });
  const path = d3.geoPath(projection);

  // Categorical colors for peak status
  const statusDomain = ["peaked", "2050", "2055plus", "no_peak"];
  const statusColors = d3.scaleOrdinal().domain(statusDomain).range(["#6e40aa", "#32a852", "#2a7fff", "#b3b3b3"]);
  const statusLabels = { "peaked": "peaked", "2050": "2050", "2055plus": "2055plus", "no_peak": "no peak (by 2100)" };

  // Water background
  mapSvg.append("path").attr("class","background").attr("d", path({ type: "Sphere" })).attr("fill", "#eef6fb");

  // Selection state
  let selected = []; // array of numeric ids (max 5)

  // Draw countries
  const countriesG = mapSvg.append("g");
  countriesG.selectAll("path.country")
    .data(countries)
    .join("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("fill", d => {
      const rec = statusById.get(+d.id);
      return rec ? statusColors(rec.status) : "#e8e8e8";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      if (!selected.includes(+d.id)) {
        d3.select(this).attr("opacity", 0.7);
      }
      const rec = statusById.get(+d.id);
      const oadr = oadrById.get(+d.id);
      if (rec && oadr) {
        const name = d.properties?.name ?? `ID ${d.id}`;
        const N = currentN();
        const rk = N===10?"oadr_p10":N===15?"oadr_p15":N===20?"oadr_p20":N===25?"oadr_p25":"oadr_p30";
        const delta = ((oadr[rk] - oadr.oadr_peak) * 100).toFixed(1);
        showTooltip(event, `${name}\nPeak: ${rec.peak_year}${rec.status==="no_peak"?" (no peak by 2100)":""}\nOADR Δ: ${delta > 0 ? '+' : ''}${delta} per 100`);
      }
    })
    .on("mouseout", function(event, d) {
      if (!selected.includes(+d.id)) {
        d3.select(this).attr("opacity", 1);
      }
      hideTooltip();
    })
    .on("click", (event, d) => {
      const id = +d.id;
      const has = selected.includes(id);
      if (event.shiftKey) {
        selected = has ? selected.filter(x => x !== id) : (selected.length < 5 ? [...selected, id] : selected);
      } else {
        selected = has ? [] : [id];
      }
      highlightSelection();
      updateSlopegraph();
      updateComponents();
      updateSummary();
    })
    .append("title")
    .text(d => {
      const rec = statusById.get(+d.id);
      const name = d.properties?.name ?? `ID ${d.id}`;
      return rec ? `${name}\nStatus: ${rec.status}\nPeak year: ${rec.peak_year}` : `${name}\n(no data)`;
    });

  function highlightSelection() {
    mapSvg.selectAll("path.country")
      .attr("stroke", d => selected.includes(+d.id) ? "#111" : "#fff")
      .attr("stroke-width", d => selected.includes(+d.id) ? 1.5 : 0.5)
      .attr("opacity", d => selected.length && !selected.includes(+d.id) ? 0.6 : 1);
  }

  // Tooltip helpers
  const tooltip = d3.select("body").append("div")
    .attr("class", "map-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(0,0,0,0.85)")
    .style("color", "#fff")
    .style("padding", "8px 12px")
    .style("border-radius", "4px")
    .style("font-size", "0.85rem")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("white-space", "pre-line")
    .style("z-index", 9999);

  function showTooltip(event, text) {
    tooltip.style("opacity", 1).html(text)
      .style("left", (event.pageX + 12) + "px")
      .style("top", (event.pageY - 8) + "px");
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
  }

  // Summary card update
  // Summary card helpers
  function fmtOADR(x) { return isFinite(x) ? d3.format(".1f")(x * 100) : "–"; }
  
  function yearsPair(id) {
    const rec = statusById.get(id);
    if (!rec) return { peak: null, right: null, clipped: false };
    const peak = rec.peak_year;
    const N = currentN();
    const right = Math.min(peak + N, 2100);
    return { peak, right, clipped: (peak === 2100 && right === 2100) };
  }

  function updateSummary() {
    const summaryDiv = d3.select("#summary");
    if (!selected.length) {
      summaryDiv.html(`
        <div class="summary-title">No country selected</div>
        <div class="summary-body">Click a country on the map (Shift-click to compare up to 5). This panel will show peak year and the change in OADR over N years.</div>
      `);
      return;
    }
    const id = selected[selected.length - 1]; // last selected
    const name = nameForId(id);
    const yrs = yearsPair(id);
    const r = oadrById.get(id);
    
    if (!r) {
      summaryDiv.html(`
        <div class="summary-title">${name}</div>
        <div class="summary-body">Data unavailable for OADR.</div>
      `);
      return;
    }
    
    const N = currentN();
    const keyN = N === 10 ? "oadr_p10" : N === 15 ? "oadr_p15" : N === 20 ? "oadr_p20" : N === 25 ? "oadr_p25" : "oadr_p30";
    const oPeak = +r.oadr_peak;
    const oN = +r[keyN];
    const d = (oN - oPeak) * 100;
    
    summaryDiv.html(`
      <div class="summary-title">${name} — Peak year: ${yrs.peak}${yrs.clipped ? " (no peak by 2100)" : ""}</div>
      <div class="summary-body">
        OADR at peak: <strong>${fmtOADR(oPeak)}</strong> per 100<br>
        OADR at peak + ${N}: <strong>${fmtOADR(oN)}</strong> per 100<br>
        Change: <strong>${d3.format("+.1f")(d)}</strong> per 100
      </div>
    `);
  }

  // Legend with dynamic query checkboxes
  let activeStatuses = new Set(["peaked", "2050", "2055plus", "no_peak"]);
  const legend = d3.select("#legend");
  legend.selectAll("label.chk")
    .data(statusDomain)
    .join("label")
    .attr("class", "chk")
    .style("margin-right", "12px")
    .style("cursor", "pointer")
    .html(s => `<input type="checkbox" checked value="${s}"> <span class="swatch" style="background:${statusColors(s)}"></span> ${statusLabels[s]}`)
    .select("input")
    .on("change", function(ev) {
      const v = this.value;
      this.checked ? activeStatuses.add(v) : activeStatuses.delete(v);
      mapSvg.selectAll("path.country")
        .attr("display", d => {
          const rec = statusById.get(+d.id);
          return rec && activeStatuses.has(rec.status) ? null : "none";
        });
    });

  // ---- Slopegraph (OADR) ----
  const slopeW = 720, slopeH = 360, m = {top: 20, right: 120, bottom: 35, left: 70};
  const slopeSvg = d3.select("#oadrChart").append("svg").attr("width", slopeW).attr("height", slopeH);
  const gSlope = slopeSvg.append("g").attr("transform", `translate(${m.left},${m.top})`);
  const innerW = slopeW - m.left - m.right;
  const innerH = slopeH - m.top - m.bottom;

  const colX = d3.scalePoint().domain(["At peak", "Peak + N"]).range([0, innerW]).padding(0.5);

  const allVals = [];
  for (const r of oadrRows) {
    ["oadr_peak","oadr_p10","oadr_p15","oadr_p20","oadr_p25","oadr_p30"].forEach(k => {
      const v = +r[k];
      if (!Number.isNaN(v) && isFinite(v)) allVals.push(v);
    });
  }
  const y = d3.scaleLinear().domain(d3.extent(allVals)).nice().range([innerH, 0]);
  const yAxis = d3.axisLeft(y).ticks(8).tickFormat(v => `${d3.format(".0f")(v*100)}`);
  gSlope.append("g").attr("class", "y-axis").call(yAxis);
  gSlope.append("text").attr("x", -m.left + 4).attr("y", -8).attr("class", "slope-subtitle").attr("fill", "currentColor").attr("font-size", 12).text("older (65+) per 100 working-age (15–64)");
  gSlope.append("text").attr("class", "col-label col-left slope-col-label").attr("x", colX("At peak")).attr("y", innerH + 28).attr("text-anchor", "middle").text("At peak");
  const colRightLabel = gSlope.append("text").attr("class", "col-label col-right slope-col-label").attr("x", colX("Peak + N")).attr("y", innerH + 28).attr("text-anchor", "middle").text("Peak + 25");

  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const linesG = gSlope.append("g").attr("class", "lines");
  const pointsG = gSlope.append("g").attr("class", "points");
  const labelsG = gSlope.append("g").attr("class", "labels");
  const emptySlope = gSlope.append("text").attr("x", innerW/2).attr("y", innerH/2).attr("text-anchor", "middle").attr("fill", "#666").text("Click a country (Shift-click to compare up to 5)");

  function currentN() { return +yearsAfterEl.property("value"); }
  yearsAfterValueEl.text(currentN());
  yearsAfterEl.on("input", function(){ 
    yearsAfterValueEl.text(this.value); 
    updateSlopegraph(); 
    updateSummary(); 
  });

  function nameForId(id){ const f = countries.find(c => +c.id === +id); return f?.properties?.name ?? `ID ${id}`; }

  function yearsFor(id){
    const rec = statusById.get(id);
    const peakYear = rec?.peak_year;
    const N = currentN();
    const rightYear = Math.min(peakYear + N, 2100);
    return { peakYear, rightYear, clipped: (peakYear===2100 && rightYear===2100) };
  }

  const isNoPeak = id => statusById.get(id)?.status === "no_peak";

  function updateSlopegraph(){
    const N = currentN();
    colRightLabel.text(`Peak + ${N}`);
    if(!selected.length){ linesG.selectAll("*").remove(); pointsG.selectAll("*").remove(); labelsG.selectAll("*").remove(); emptySlope.style("display", null); return; }
    emptySlope.style("display", "none");
    const series = selected.map(id => { const r = oadrById.get(id); if(!r) return null; const rightKey = N===10?"oadr_p10":N===15?"oadr_p15":N===20?"oadr_p20":N===25?"oadr_p25":"oadr_p30"; return { id, name: nameForId(id), left:+r.oadr_peak, right:+r[rightKey] }; }).filter(Boolean);
    const lineSel = linesG.selectAll("path.slope").data(series, d=>d.id);
    lineSel.enter().append("path").attr("class","slope").attr("fill","none").attr("stroke-width",2)
      .attr("stroke", d=>color(d.id))
      .attr("stroke-dasharray", d => isNoPeak(d.id) ? "4,3" : null)
      .merge(lineSel).attr("d", d=>d3.line()([[colX("At peak"), y(d.left)],[colX("Peak + N"), y(d.right)]]));
    lineSel.exit().remove();
    const ptData = series.flatMap(d => ([{id:d.id, side:"left", x:colX("At peak"), y:y(d.left), color:color(d.id), name:d.name},{id:d.id, side:"right", x:colX("Peak + N"), y:y(d.right), color:color(d.id), name:d.name}]));
    const pts = pointsG.selectAll("circle.pt").data(ptData, d=>`${d.id}:${d.side}`);
    const ptsEnter = pts.enter().append("circle").attr("class","pt").attr("r",4).attr("stroke","#111").attr("stroke-width",0.8).attr("fill", d=>d.color);
    ptsEnter.append("title");
    ptsEnter.merge(pts).attr("cx", d=>d.x).attr("cy", d=>d.y)
      .select("title")
      .text(d => {
        const yrs = yearsFor(d.id);
        const yLabel = d.side==="left" ? `OADR @ ${yrs.peakYear}` : `OADR @ ${yrs.rightYear}${yrs.clipped ? " (no peak by 2100)" : ""}`;
        const val = d3.format(".1f")(y.invert(d.y) * 100);
        return `${d.name}\n${yLabel}: ${val} per 100`;
      });
    pts.exit().remove();
    const lab = labelsG.selectAll("text.lab").data(series, d=>d.id);
    lab.enter().append("text").attr("class","lab").attr("font-size",12).attr("dy","0.35em").attr("fill", d=>color(d.id)).merge(lab).attr("x", colX("Peak + N") + 6).attr("y", d=>y(d.right)).text(d=>d.name); lab.exit().remove();
  }

  // ---- Components chart (decadal population change) ----
  const controls = d3.select("#controls");
  const wrap = controls.append("div").attr("class","control");
  wrap.append("label").attr("for","decadeSel").text("Decade:");
  const decadeSel = wrap.append("select").attr("id","decadeSel");
  const modeWrap = controls.append("div").attr("class","control");
  modeWrap.append("span").text("Mode:");
  modeWrap.append("label").html(`<input type="radio" name="mode" value="abs" checked> Absolute`);
  modeWrap.append("label").style("margin-left","8px").html(`<input type="radio" name="mode" value="per1k"> Per 1k/yr`);
  function currentMode(){ return document.querySelector('input[name="mode"]:checked').value; }
  const decades = Array.from(new Set(componentsRows.map(d => d.decade_start))).sort((a,b)=>a-b);
  decadeSel.selectAll("option").data(decades).join("option").attr("value", d=>d).text(d=>`${d}–${d+9}`);
  decadeSel.property("value", d3.max(decades));
  decadeSel.on("change", updateComponents);
  d3.selectAll('input[name="mode"]').on("change", updateComponents);

  const compW = 720, compH = 320, cm = {top:24, right:16, bottom:40, left:70};
  const compContainer = d3.select("#componentsChart");
  const emptyComp = compContainer.append("div").attr("class", "empty-comp-msg").style("text-align","center").style("color","#666").style("padding","2rem").text("Select a country to see components of change");
  const compColor = new Map([["Births", "#69b34c"],["Deaths", "#d73027"],["Net migration", "#2b8cbe"],["Δ population", "#7f7f7f"],["Natural (per 1k)", "#69b34c"],["Migration (per 1k)", "#2b8cbe"],["Total (per 1k)", "#7f7f7f"]]);

  function updateComponents(){
    const decade = +decadeSel.property("value");
    const mode = currentMode();
    
    if(!selected.length){ 
      compContainer.selectAll("svg.comp-svg").remove();
      emptyComp.style("display", null);
      return;
    }
    emptyComp.style("display","none");
    
    const ids = selected.slice(-4); // up to 4 most recent selections
    const isMulti = ids.length > 1;
    
    // Determine layout
    let smallW, smallH, smallM;
    if (isMulti) {
      // 2×2 grid of small multiples
      smallW = 340;
      smallH = 200;
      smallM = {top: 32, right: 12, bottom: 35, left: 50};
    } else {
      // Single large chart
      smallW = compW;
      smallH = compH;
      smallM = cm;
    }
    
    // Gather all data for shared scale
    const allData = [];
    ids.forEach(id => {
      const row = componentsRows.find(d => d.id === id && d.decade_start === decade);
      if (!row) return;
      let vals;
      if(mode === "abs"){
        vals = [row.births, -row.deaths, row.net_migration, row.total_change];
      } else {
        vals = [row.rate_natural_per_1k, row.rate_migration_per_1k, row.rate_total_per_1k];
      }
      allData.push(...vals.filter(v => isFinite(v)));
    });
    
    const pad = d3.max(allData.map(v=>Math.abs(v))) * 0.1 || 1;
    const ymin = d3.min([0, d3.min(allData)]) - pad;
    const ymax = d3.max([0, d3.max(allData)]) + pad;
    const sharedY = d3.scaleLinear().domain([ymin, ymax]).range([smallH - smallM.top - smallM.bottom, 0]).nice();
    
    // Bind SVGs
    const svgs = compContainer.selectAll("svg.comp-svg").data(ids, d => d);
    svgs.exit().remove();
    
    const svgsEnter = svgs.enter().append("svg")
      .attr("class", "comp-svg")
      .style("display", "inline-block")
      .style("vertical-align", "top");
    
    const svgsMerge = svgsEnter.merge(svgs)
      .attr("width", smallW)
      .attr("height", smallH);
    
    svgsMerge.each(function(id) {
      const svg = d3.select(this);
      const row = componentsRows.find(d => d.id === id && d.decade_start === decade);
      const name = nameForId(id);
      
      let g = svg.select("g.main");
      if (g.empty()) {
        g = svg.append("g").attr("class", "main");
      }
      g.attr("transform", `translate(${smallM.left},${smallM.top})`);
      
      const innerW = smallW - smallM.left - smallM.right;
      const innerH = smallH - smallM.top - smallM.bottom;
      
      let data, yLabel = "";
      if(mode === "abs"){
        data = [
          {k:"Births", v: row?.births ?? 0},
          {k:"Deaths", v: -(row?.deaths ?? 0)},
          {k:"Net migration", v: row?.net_migration ?? 0},
          {k:"Δ pop", v: row?.total_change ?? 0}
        ];
        yLabel = isMulti ? "(thousands)" : "Change over decade (thousands)";
      } else {
        data = [
          {k:"Natural", v: row?.rate_natural_per_1k ?? NaN},
          {k:"Migr.", v: row?.rate_migration_per_1k ?? NaN},
          {k:"Total", v: row?.rate_total_per_1k ?? NaN}
        ];
        yLabel = isMulti ? "(per 1k/yr)" : "Avg annual rate (per 1,000)";
      }
      
      const xScale = d3.scaleBand().domain(data.map(d=>d.k)).range([0, innerW]).padding(0.25);
      
      // Axes
      let xAxisG = g.select("g.x-axis");
      if (xAxisG.empty()) {
        xAxisG = g.append("g").attr("class", "x-axis");
      }
      xAxisG.attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(xScale).tickSize(3));
      xAxisG.selectAll("text").attr("font-size", isMulti ? 9 : 11);
      
      let yAxisG = g.select("g.y-axis");
      if (yAxisG.empty()) {
        yAxisG = g.append("g").attr("class", "y-axis");
      }
      yAxisG.call(d3.axisLeft(sharedY).ticks(isMulti ? 4 : 8).tickSize(3));
      yAxisG.selectAll("text").attr("font-size", isMulti ? 9 : 11);
      
      // Bars
      const bars = g.selectAll("rect.bar").data(data, d=>d.k);
      const barsEnter = bars.enter().append("rect").attr("class","bar")
        .attr("fill", d=>compColor.get(d.k) || "#888");
      barsEnter.append("title");
      
      barsEnter.merge(bars)
        .attr("x", d=>xScale(d.k))
        .attr("width", xScale.bandwidth())
        .attr("y", d=>Math.min(sharedY(0), sharedY(d.v)))
        .attr("height", d=>Math.abs(sharedY(d.v)-sharedY(0)))
        .select("title")
        .text(d => `${d.k}: ${d3.format(",.0f")(d.v)}`);
      
      bars.exit().remove();
      
      // Title
      let titleSel = svg.select("text.comp-title");
      if (titleSel.empty()) {
        titleSel = svg.append("text").attr("class","comp-title");
      }
      titleSel.attr("x", smallM.left).attr("y", 16)
        .attr("font-size", isMulti ? 11 : 14)
        .attr("font-weight", 600)
        .attr("fill", "currentColor")
        .text(`${name}: ${decade}–${decade+9}`);
      
      // Subtitle
      let subSel = svg.select("text.comp-sub");
      if (subSel.empty()) {
        subSel = svg.append("text").attr("class","comp-sub");
      }
      subSel.attr("x", smallM.left).attr("y", isMulti ? 28 : 32)
        .attr("font-size", isMulti ? 9 : 12)
        .attr("font-style", "italic")
        .attr("fill", "currentColor")
        .attr("opacity", 0.7)
        .text(yLabel);
    });
  }

  // ---- Initial paints ----
  highlightSelection();
  updateSlopegraph();
  updateComponents();
  updateSummary();

  // ---- Responsive map resize ----
    const mapBlockEl = document.querySelector('.map-container');
  function resizeMap() {
    if (!mapBlockEl) return;
    const w = mapBlockEl.clientWidth;
    const h = Math.max(320, Math.round(w * 0.48)); // maintain aspect ratio, min height
    mapSvg.attr('width', w).attr('height', h);
    projection.fitSize([w, h], { type: 'Sphere' });
    mapSvg.selectAll('path.country').attr('d', path);
    mapSvg.select('path.background').attr('d', path({ type: 'Sphere' }));
  }
  // Use ResizeObserver for smooth updates
  const ro = new ResizeObserver(() => {
    resizeMap();
  });
  if (mapBlockEl) ro.observe(mapBlockEl);
  // Initial resize to override intrinsic size
  resizeMap();

  // ---- Country search & clear selection ----
  countrySearchEl.on("input", function() {
    const query = this.value.trim().toLowerCase();
    if (!query) return;
    const match = countries.find(c => (c.properties?.name || "").toLowerCase().includes(query));
    if (match) {
      const id = +match.id;
      if (!selected.includes(id)) {
        selected = selected.length < 5 ? [...selected, id] : [...selected.slice(1), id];
        highlightSelection();
        updateSlopegraph();
        updateComponents();
        updateSummary();
      }
    }
  });

  clearSelectionBtn.on("click", () => {
    selected = [];
    highlightSelection();
    updateSlopegraph();
    updateComponents();
    updateSummary();
  });
})();
