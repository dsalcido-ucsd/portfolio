import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import * as topojson from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

(async function () {
  // ---- DOM refs
  const mapSvg = d3.select("#map");
  const mapW = +mapSvg.attr("width");
  const mapH = +mapSvg.attr("height");

  const yearsAfterEl = d3.select("#yearsAfter");
  const yearsAfterValueEl = d3.select("#yearsAfterValue");

  // ---- Load data (added componentsRows)
  const [world, peakStatus, oadrRows, componentsRows] = await Promise.all([
    d3.json("./project3/data/countries-110m.json"),
    d3.csv("./project3/data/peak_status.csv", d => ({ id: +d.id, status: d.status, peak_year: +d.peak_year })),
    d3.csv("./project3/data/oadr_peaks.csv", d => ({
      id: +d.id,
      oadr_peak: +d.oadr_peak,
      oadr_p10: +d.oadr_p10,
      oadr_p15: +d.oadr_p15,
      oadr_p20: +d.oadr_p20,
      oadr_p25: +d.oadr_p25,
      oadr_p30: +d.oadr_p30
    })),
    d3.csv("./project3/data/components_decades.csv", d => ({
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

  // Water background
  mapSvg.append("path").attr("d", path({ type: "Sphere" })).attr("fill", "#eef6fb");

  // Selection state
  let selected = []; // array of numeric ids (max 5)

  // Draw countries
  mapSvg.append("g")
    .selectAll("path.country")
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
      updateComponents(); // hook components chart
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

  // Legend
  const legend = d3.select("#legend");
  legend.selectAll("span.item")
    .data(statusDomain)
    .join("span")
    .attr("class", "item")
    .style("margin-right", "12px")
    .html(s => `<span class="swatch" style="background:${statusColors(s)}"></span> ${s}`);

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
  gSlope.append("text").attr("x", -m.left + 4).attr("y", -8).attr("fill", "#444").attr("font-size", 12).text("older (65+) per 100 working-age (15–64)");
  gSlope.append("text").attr("class", "col-label col-left").attr("x", colX("At peak")).attr("y", innerH + 28).attr("text-anchor", "middle").text("At peak");
  const colRightLabel = gSlope.append("text").attr("class", "col-label col-right").attr("x", colX("Peak + N")).attr("y", innerH + 28).attr("text-anchor", "middle").text("Peak + 25");

  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const linesG = gSlope.append("g").attr("class", "lines");
  const pointsG = gSlope.append("g").attr("class", "points");
  const labelsG = gSlope.append("g").attr("class", "labels");
  const emptySlope = gSlope.append("text").attr("x", innerW/2).attr("y", innerH/2).attr("text-anchor", "middle").attr("fill", "#666").text("Click a country (Shift-click to compare up to 5)");

  function currentN() { return +yearsAfterEl.property("value"); }
  yearsAfterValueEl.text(currentN());
  yearsAfterEl.on("input", function(){ yearsAfterValueEl.text(this.value); updateSlopegraph(); });

  function nameForId(id){ const f = countries.find(c => +c.id === +id); return f?.properties?.name ?? `ID ${id}`; }

  function updateSlopegraph(){
    const N = currentN();
    colRightLabel.text(`Peak + ${N}`);
    if(!selected.length){ linesG.selectAll("*").remove(); pointsG.selectAll("*").remove(); labelsG.selectAll("*").remove(); emptySlope.style("display", null); return; }
    emptySlope.style("display", "none");
    const series = selected.map(id => { const r = oadrById.get(id); if(!r) return null; const rightKey = N===10?"oadr_p10":N===15?"oadr_p15":N===20?"oadr_p20":N===25?"oadr_p25":"oadr_p30"; return { id, name: nameForId(id), left:+r.oadr_peak, right:+r[rightKey] }; }).filter(Boolean);
    const lineSel = linesG.selectAll("path.slope").data(series, d=>d.id);
    lineSel.enter().append("path").attr("class","slope").attr("fill","none").attr("stroke-width",2).attr("stroke", d=>color(d.id)).merge(lineSel).attr("d", d=>d3.line()([[colX("At peak"), y(d.left)],[colX("Peak + N"), y(d.right)]]));
    lineSel.exit().remove();
    const ptData = series.flatMap(d => ([{id:d.id, side:"left", x:colX("At peak"), y:y(d.left), color:color(d.id), name:d.name},{id:d.id, side:"right", x:colX("Peak + N"), y:y(d.right), color:color(d.id), name:d.name}]));
    const pts = pointsG.selectAll("circle.pt").data(ptData, d=>`${d.id}:${d.side}`);
    pts.enter().append("circle").attr("class","pt").attr("r",4).attr("stroke","#111").attr("stroke-width",0.8).attr("fill", d=>d.color).merge(pts).attr("cx", d=>d.x).attr("cy", d=>d.y); pts.exit().remove();
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
  const compSvg = d3.select("#componentsChart").append("svg").attr("width", compW).attr("height", compH);
  const gComp = compSvg.append("g").attr("transform", `translate(${cm.left},${cm.top})`);
  const cw = compW - cm.left - cm.right;
  const ch = compH - cm.top - cm.bottom;
  const xComp = d3.scaleBand().padding(0.25);
  const yComp = d3.scaleLinear();
  const xAxisG = gComp.append("g").attr("transform", `translate(0,${ch})`);
  const yAxisG = gComp.append("g");
  const emptyComp = gComp.append("text").attr("x", cw/2).attr("y", ch/2).attr("text-anchor","middle").attr("fill","#666").text("Select a country to see components of change");
  const compColor = new Map([["Births", "#69b34c"],["Deaths", "#d73027"],["Net migration", "#2b8cbe"],["Δ population", "#7f7f7f"],["Natural (per 1k)", "#69b34c"],["Migration (per 1k)", "#2b8cbe"],["Total (per 1k)", "#7f7f7f"]]);

  function updateComponents(){
    const id = selected.length ? selected[selected.length-1] : null; // last-picked
    const decade = +decadeSel.property("value");
    const mode = currentMode();
    if(!id){ gComp.selectAll("rect.bar").remove(); gComp.selectAll("text.comp-label").remove(); xAxisG.selectAll("*").remove(); yAxisG.selectAll("*").remove(); emptyComp.style("display", null); return; }
    emptyComp.style("display","none");
    const row = componentsRows.find(d => d.id === id && d.decade_start === decade);
    const name = nameForId(id);
    let data, yLabel = "";
    if(mode === "abs"){
      data = [
        {k:"Births", v: row?.births ?? 0},
        {k:"Deaths", v: -(row?.deaths ?? 0)},
        {k:"Net migration", v: row?.net_migration ?? 0},
        {k:"Δ population", v: row?.total_change ?? 0}
      ];
      yLabel = "Change over decade (units match file)";
    } else {
      data = [
        {k:"Natural (per 1k)", v: row?.rate_natural_per_1k ?? NaN},
        {k:"Migration (per 1k)", v: row?.rate_migration_per_1k ?? NaN},
        {k:"Total (per 1k)", v: row?.rate_total_per_1k ?? NaN}
      ];
      yLabel = "Avg annual rate (per 1,000)";
    }
    xComp.domain(data.map(d=>d.k)).range([0, cw]);
    const vals = data.map(d=>d.v).filter(v=>isFinite(v));
    const pad = d3.max(vals.map(v=>Math.abs(v))) * 0.1 || 1;
    const ymin = d3.min([0, d3.min(vals)]) - pad;
    const ymax = d3.max([0, d3.max(vals)]) + pad;
    yComp.domain([ymin, ymax]).range([ch, 0]).nice();
    xAxisG.call(d3.axisBottom(xComp));
    yAxisG.call(d3.axisLeft(yComp));
    const bars = gComp.selectAll("rect.bar").data(data, d=>d.k);
    bars.enter().append("rect").attr("class","bar").attr("x", d=>xComp(d.k)).attr("width", xComp.bandwidth()).attr("y", yComp(0)).attr("height",0).attr("fill", d=>compColor.get(d.k) || "#888").merge(bars)
      .transition().duration(300)
      .attr("x", d=>xComp(d.k)).attr("width", xComp.bandwidth()).attr("y", d=>Math.min(yComp(0), yComp(d.v))).attr("height", d=>Math.abs(yComp(d.v)-yComp(0)));
    bars.exit().remove();
    const titleSel = compSvg.selectAll("text.comp-title").data([`${name}: ${decade}–${decade+9}`]);
    titleSel.enter().append("text").attr("class","comp-title").attr("x", cm.left).attr("y", 16).attr("font-size",14).attr("fill", "#333").merge(titleSel).text(d=>d);
    const subSel = compSvg.selectAll("text.comp-sub").data([yLabel]);
    subSel.enter().append("text").attr("class","comp-sub").attr("x", cm.left).attr("y", 32).attr("font-size",12).attr("fill", "#666").merge(subSel).text(d=>d);
  }

  // ---- Initial paints ----
  highlightSelection();
  updateSlopegraph();
  updateComponents();
})();
