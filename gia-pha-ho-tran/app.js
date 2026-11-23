// Gia Phả Họ Trần Lãng Nam — Bộ Điều Phối 5 Phong Cách Giao Diện
(function () {
  const membersById = {};
  const childrenById = {};
  window.MEMBERS.forEach(m => {
    membersById[m.id] = m;
    childrenById[m.id] = [];
  });
  window.MEMBERS.forEach(m => {
    if (m.parentId && childrenById[m.parentId]) {
      childrenById[m.parentId].push(m);
    }
  });

  function buildHierarchy() {
    const buildNode = (m) => ({
      ...m,
      children: (childrenById[m.id] || []).map(buildNode)
    });
    const rootMember = window.MEMBERS.find(m => !m.parentId);
    return buildNode(rootMember);
  }

  let currentStyle = 1;
  const renderedStyles = {};

  // ----------------- CHUYỂN ĐỔI 5 PHONG CÁCH -----------------
  window.switchStyle = function (styleNum) {
    currentStyle = Number(styleNum);
    document.body.setAttribute("data-style", String(currentStyle));
    document.querySelectorAll(".style-btn").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.style) === currentStyle);
    });
    document.querySelectorAll(".style-view").forEach(v => {
      v.classList.toggle("active", Number(v.dataset.style) === currentStyle);
    });
    if (window.location.hash !== `#style=${currentStyle}`) {
      history.replaceState(null, "", `#style=${currentStyle}`);
    }
    if (!renderedStyles[currentStyle]) {
      renderedStyles[currentStyle] = true;
      if (currentStyle === 1) initStyle1();
      if (currentStyle === 2) initStyle2();
      if (currentStyle === 3) initStyle3();
      if (currentStyle === 4) initStyle4();
      if (currentStyle === 5) initStyle5();
    }
  };

  // ----------------- PHONG CÁCH 1: SƠN SON THIẾP VÀNG (D3 TREE) -----------------
  let s1Orientation = "vertical"; // vertical | horizontal
  let s1TreeFn = null;

  function initStyle1() {
    const container = document.getElementById("style1Canvas");
    container.innerHTML = "";
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight - 64;

    const svg = d3.select("#style1Canvas").append("svg").attr("class", "s1-svg");
    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.15, 2.5]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    const root = d3.hierarchy(buildHierarchy());
    root.x0 = width / 2;
    root.y0 = 40;

    // Thu gọn nhẹ các nhánh phụ sâu để nhìn tổng quan đẹp mắt ngay khi mở
    function update(source) {
      const isVert = s1Orientation === "vertical";
      const nodeSize = isVert ? [175, 115] : [64, 230];
      const treeLayout = d3.tree().nodeSize(nodeSize);
      treeLayout(root);

      const nodes = root.descendants();
      const links = root.links();

      const linkSel = g.selectAll("path.s1-link").data(links, d => d.target.data.id);
      const linkEnter = linkSel.enter().insert("path", "g")
        .attr("class", d => `s1-link ${d.target.data.isMainLine ? "main-line" : ""}`);

      linkEnter.merge(linkSel).transition().duration(350)
        .attr("d", d => {
          if (isVert) {
            return `M${d.source.x},${d.source.y + 26} C${d.source.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${d.target.y - 26}`;
          } else {
            return `M${d.source.y + 78},${d.source.x} C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y - 78},${d.target.x}`;
          }
        });
      linkSel.exit().remove();

      const nodeSel = g.selectAll("g.s1-node-card").data(nodes, d => d.data.id);
      const nodeEnter = nodeSel.enter().append("g")
        .attr("class", d => `s1-node-card ${d.data.isMainLine ? "main-line" : ""}`)
        .on("click", (event, d) => {
          event.stopPropagation();
          openMemberModal(d.data.id);
        });

      nodeEnter.append("rect").attr("class", "s1-node-rect")
        .attr("width", 156).attr("height", 52).attr("x", -78).attr("y", -26);

      nodeEnter.append("text").attr("class", "s1-node-gen")
        .attr("x", 0).attr("y", -8).attr("text-anchor", "middle")
        .text(d => `Đời ${d.data.gen}${d.data.isMainLine ? " • Trực Hệ" : ""}`);

      nodeEnter.append("text").attr("class", "s1-node-name")
        .attr("x", 0).attr("y", 11).attr("text-anchor", "middle")
        .text(d => d.data.name.length > 20 ? d.data.name.slice(0, 19) + "…" : d.data.name);

      // Nút +/- thu gọn nhánh con
      const toggleBtn = nodeEnter.filter(d => (d.children || d._children))
        .append("g").attr("class", "s1-toggle")
        .attr("transform", isVert ? "translate(0, 26)" : "translate(78, 0)")
        .on("click", (event, d) => {
          event.stopPropagation();
          if (d.children) { d._children = d.children; d.children = null; }
          else { d.children = d._children; d._children = null; }
          update(d);
        });
      toggleBtn.append("circle").attr("r", 9).attr("class", "s1-node-badge");
      toggleBtn.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("fill", "#f6d365").attr("font-size", "11px").attr("font-weight", "bold")
        .text(d => d.children ? "−" : "+");

      const nodeUpdate = nodeEnter.merge(nodeSel);
      nodeUpdate.transition().duration(350)
        .attr("transform", d => isVert ? `translate(${d.x},${d.y})` : `translate(${d.y},${d.x})`);
      nodeUpdate.select(".s1-toggle")
        .attr("transform", isVert ? "translate(0, 26)" : "translate(78, 0)")
        .select("text").text(d => d.children ? "−" : "+");

      nodeSel.exit().remove();
    }

    s1TreeFn = {
      update: () => update(root),
      resetZoom: () => {
        const t = s1Orientation === "vertical"
          ? d3.zoomIdentity.translate(width / 2, 70).scale(0.72)
          : d3.zoomIdentity.translate(120, height / 2).scale(0.75);
        svg.transition().duration(500).call(zoom.transform, t);
      },
      expandAll: () => {
        root.each(d => { if (d._children) { d.children = d._children; d._children = null; } });
        update(root);
      },
      collapseToMain: () => {
        root.each(d => {
          if (d.depth >= 6 && !d.data.isMainLine && d.children) {
            d._children = d.children; d.children = null;
          }
        });
        update(root);
      }
    };

    update(root);
    s1TreeFn.resetZoom();
  }

  window.s1ToggleOrientation = function () {
    s1Orientation = s1Orientation === "vertical" ? "horizontal" : "vertical";
    document.getElementById("s1OrientBtn").textContent = s1Orientation === "vertical" ? "⇄ Chuyển Cây Ngang" : "⇅ Chuyển Cây Dọc";
    if (s1TreeFn) { s1TreeFn.update(); s1TreeFn.resetZoom(); }
  };
  window.s1Reset = () => s1TreeFn && s1TreeFn.resetZoom();
  window.s1ExpandAll = () => s1TreeFn && s1TreeFn.expandAll();

  // ----------------- PHONG CÁCH 2: NGỌC BÍCH HOÀNG TRIỀU (DONATSO/FAMILY-CHART) -----------------
  let f3ChartInstance = null;
  async function initStyle2() {
    const container = document.getElementById("FamilyChartContainer");
    container.innerHTML = `<div style="padding:40px;text-align:center;opacity:0.8;">Đang khởi tạo thư viện mã nguồn mở donatso/family-chart...</div>`;
    let f3Lib = window.f3;
    if (!f3Lib) {
      try {
        f3Lib = await import("https://unpkg.com/family-chart@0.9.0/dist/family-chart.esm.js");
        window.f3 = f3Lib;
      } catch (err) {
        f3Lib = null;
      }
    }
    container.innerHTML = "";
    if (!f3Lib) {
      container.innerHTML = `<div style="padding:40px;text-align:center;">
        <h3>Không tải được thư viện family-chart từ CDN</h3>
        <p style="opacity:0.8;margin-top:8px;">Vui lòng kiểm tra kết nối mạng hoặc chuyển sang Phong cách 1, 3, 4, 5.</p>
      </div>`;
      return;
    }

    const fcData = window.buildFamilyChartData();
    f3ChartInstance = f3Lib.createChart("#FamilyChartContainer", fcData)
      .setTransitionTime(600)
      .setCardXSpacing(245)
      .setCardYSpacing(135);

    const f3Card = f3ChartInstance.setCard(f3Lib.CardHtml)
      .setCardDisplay([["full name"], ["gen"], ["dates"]])
      .setCardDim({ w: 215, h: 82 })
      .setOnCardClick((e, d) => {
        f3ChartInstance.updateMainId(d.data.id);
        f3ChartInstance.updateTree({});
        const rawId = d.data.data.rawId;
        if (rawId && membersById[rawId]) {
          document.getElementById("s2FocusName").textContent = `${d.data.data["full name"]} (${d.data.data.gen})`;
        }
      });

    // Tùy biến HTML Card phong cách Ngọc Bích Hoàng Triều
    if (typeof f3Card.setCardHtml === "function") {
      f3Card.setCardHtml(d => {
        const isFem = d.data.data.gender === "F";
        const isMain = d.data.main;
        return `<div class="f3-jade-card ${isFem ? "female" : ""} ${isMain ? "main-focus" : ""}">
          <div class="f3-jade-gen">${d.data.data.gen || ""}</div>
          <div class="f3-jade-name">${d.data.data["full name"] || ""}</div>
          <div class="f3-jade-dates">${d.data.data.dates || ""}</div>
        </div>`;
      });
    }

    // Đặt Cụ Chí Hòa (Đời 20) làm tâm điểm mặc định để nhìn rõ cả tổ tiên phía trên và 4 thế hệ con cháu phía dưới
    f3ChartInstance.updateMainId("d20_chi_hoa");
    f3ChartInstance.updateTree({ initial: true });
  }

  window.s2FocusMember = function (id) {
    if (!f3ChartInstance) return;
    f3ChartInstance.updateMainId(id);
    f3ChartInstance.updateTree({});
    const m = membersById[id];
    if (m) document.getElementById("s2FocusName").textContent = `${m.name} (Đời ${m.gen})`;
  };

  // ----------------- PHONG CÁCH 3: TINH TÚ NGÂN HÀ (COSMIC RADIAL & FORCE) -----------------
  let s3Mode = "radial"; // radial | force
  function initStyle3() {
    drawStarfieldCanvas();
    renderStyle3Graph();
  }

  function drawStarfieldCanvas() {
    const canvas = document.getElementById("s3Starfield");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 190; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 1.5;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderStyle3Graph() {
    const container = document.getElementById("style3Canvas");
    container.innerHTML = "";
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight - 64;

    const svg = d3.select("#style3Canvas").append("svg").attr("class", "s3-svg");
    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    const root = d3.hierarchy(buildHierarchy());

    if (s3Mode === "radial") {
      const radius = Math.min(width, height) * 0.44;
      const tree = d3.tree().size([2 * Math.PI, radius * 1.45]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
      tree(root);

      // Vòng quỹ đạo đồng tâm
      for (let gen = 2; gen <= 24; gen += 3) {
        g.append("circle").attr("class", "s3-orbit").attr("r", (gen / 24) * radius * 1.45);
      }

      g.selectAll("path.s3-link").data(root.links()).enter().append("path")
        .attr("class", d => `s3-link ${d.target.data.isMainLine ? "main-line" : ""}`)
        .attr("d", d3.linkRadial().angle(d => d.x).radius(d => d.y));

      const node = g.selectAll("g.s3-star").data(root.descendants()).enter().append("g")
        .attr("class", "s3-star")
        .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
        .on("click", (e, d) => openMemberModal(d.data.id));

      node.append("circle")
        .attr("r", d => d.data.isMainLine ? 6 : 4)
        .attr("fill", d => d.data.isMainLine ? "#fbbf24" : (d.data.gender === "F" ? "#f472b6" : "#60a5fa"));

      node.append("text").attr("class", "s3-label")
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI === !d.children ? 9 : -9)
        .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
        .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
        .text(d => `${d.data.name} (Đ${d.data.gen})`);

      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));
    } else {
      // Force-Directed Galaxy
      const nodes = root.descendants().map(d => ({ ...d.data, depth: d.depth }));
      const links = root.links().map(l => ({ source: l.source.data.id, target: l.target.data.id, isMain: l.target.data.isMainLine }));

      const sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(55))
        .force("charge", d3.forceManyBody().strength(-160))
        .force("center", d3.forceCenter(width / 2, height / 2));

      const link = g.selectAll("line").data(links).enter().append("line")
        .attr("class", d => `s3-link ${d.isMain ? "main-line" : ""}`);

      const node = g.selectAll("g.s3-star").data(nodes).enter().append("g")
        .attr("class", "s3-star")
        .on("click", (e, d) => openMemberModal(d.id))
        .call(d3.drag()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

      node.append("circle")
        .attr("r", d => d.isMainLine ? 7 : 5)
        .attr("fill", d => d.isMainLine ? "#fbbf24" : (d.gender === "F" ? "#f472b6" : "#60a5fa"));
      node.append("text").attr("class", "s3-label").attr("x", 9).attr("dy", "0.35em")
        .text(d => `${d.name}`);

      sim.on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    }
  }

  window.s3ToggleMode = function () {
    s3Mode = s3Mode === "radial" ? "force" : "radial";
    document.getElementById("s3ModeBtn").textContent = s3Mode === "radial" ? "✦ Chuyển Mạng Lưới Trọng Lực" : "◎ Chuyển Quỹ Đạo Đồng Tâm";
    renderStyle3Graph();
  };

  // ----------------- PHONG CÁCH 4: THƯ TỊCH CỔ & SÁCH GIA PHẢ -----------------
  function initStyle4() {
    const el = document.getElementById("style4Book");
    const meta = window.PHAM_PHO_META;
    const gens = {};
    window.MEMBERS.forEach(m => {
      if (!gens[m.gen]) gens[m.gen] = [];
      gens[m.gen].push(m);
    });

    const genHtml = Object.keys(gens).sort((a, b) => Number(a) - Number(b)).map(gNum => {
      const list = gens[gNum];
      const cards = list.map(m => {
        const spText = m.spouses && m.spouses.length
          ? `<div style="font-size:12px;color:#6e1414;margin-top:4px;">Phối ngẫu: ${m.spouses.map(s => s.name + (s.death ? ` (Mất: ${s.death})` : "")).join("; ")}</div>` : "";
        return `<div class="book-person ${m.isMainLine ? "main-line" : ""}" onclick="openMemberModal('${m.id}')">
          <div style="font-weight:700;font-size:14.5px;color:#241c15;">${m.name}</div>
          <div style="font-size:12px;color:#6b5b4b;">${m.branch}${m.birth ? " • Sinh: " + m.birth : ""}${m.death ? " • Mất: " + m.death : ""}</div>
          ${spText}
        </div>`;
      }).join("");
      return `<div class="book-gen-group">
        <div class="book-gen-head" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'grid' : 'none'">
          <span>Đời thứ ${gNum} (${list.length} vị)</span>
          <span>▾</span>
        </div>
        <div class="book-gen-body">${cards}</div>
      </div>`;
    }).join("");

    el.innerHTML = `<div class="book-container">
      <div class="book-cover">
        <div class="book-seal-big">TỘC PHẢ TRUYỀN ĐỜI • LÃNG NAM</div>
        <h1 class="book-title">${meta.title}</h1>
        <p class="book-sub">${meta.subtitle}</p>
        <div class="book-couplet">
          <span>“${meta.couplet.top}”</span>
          <span>“${meta.couplet.bottom}”</span>
        </div>
      </div>

      <div class="book-section">
        <h2 class="book-h2">Phần 1: Lời Nói Đầu & Đạo Hiếu</h2>
        ${meta.foreword.map(p => `<p class="book-p">${p}</p>`).join("")}
        <div class="book-poem">
          <div style="font-weight:700;margin-bottom:8px;color:#9e1b1b;">Bài thơ khai khẩn của ${meta.poem.author} (${meta.poem.date})</div>
          ${meta.poem.lines.map(l => `<div>${l}</div>`).join("")}
        </div>
      </div>

      <div class="book-section">
        <h2 class="book-h2">Phần 2: Nguồn Gốc & Bước Ngoặt Lịch Sử</h2>
        <p class="book-p">${meta.origin}</p>
        <p class="book-p"><strong>Bước ngoặt đổi họ (Đời 7 → Đời 8):</strong> ${meta.turningPoint}</p>
      </div>

      <div class="book-section">
        <h2 class="book-h2">Phần 3: Phả Đồ Truyền Thừa (Đời 1 – Đời 24)</h2>
        <p class="book-p" style="font-size:13px;opacity:0.8;">Nhấp vào tên từng vị để xem Bia Ký chi tiết, tổ tiên trực hệ và hậu duệ.</p>
        ${genHtml}
      </div>
    </div>`;
  }

  // ----------------- PHONG CÁCH 5: BENTO DASHBOARD & TIMELINE -----------------
  let s5BranchFilter = "ALL";
  function initStyle5() {
    const el = document.getElementById("style5Bento");
    const total = window.MEMBERS.length;
    const branches = ["ALL", ...new Set(window.MEMBERS.map(m => m.branch))];
    const options = window.MEMBERS.map(m => `<option value="${m.id}">Đời ${m.gen} — ${m.name}</option>`).join("");

    el.innerHTML = `<div class="bento-wrap">
      <div class="bento-kpis">
        <div class="bento-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">Thành viên được ghi danh trong phả đồ</div></div>
        <div class="bento-card"><div class="kpi-val">24 Đời</div><div class="kpi-lbl">Từ Đức Thượng Tổ Trần Kinh (1009) đến 2026</div></div>
        <div class="bento-card"><div class="kpi-val">3 Giai Đoạn</div><div class="kpi-lbl">Thủy Tổ • Trực Hệ Đời 8–19 • Chi Chí Hòa</div></div>
        <div class="bento-card"><div class="kpi-val">3 Tỉnh/TP</div><div class="kpi-lbl">Ninh Bình • Hà Nội • Bảo Lộc (Lâm Đồng)</div></div>
      </div>

      <div class="bento-grid-2">
        <div class="bento-card">
          <h3 style="margin-bottom:12px;font-size:16px;">⚡ Tra Cứu Quan Hệ & Khoảng Cách Đời</h3>
          <div class="rel-calc">
            <div class="rel-selects">
              <select id="relA" class="rel-select" onchange="calcRelation()">${options}</select>
              <select id="relB" class="rel-select" onchange="calcRelation()">${options}</select>
            </div>
            <div id="relOutput" class="rel-output"></div>
          </div>
        </div>

        <div class="bento-card">
          <h3 style="margin-bottom:14px;font-size:16px;">⏳ Dòng Thời Gian Lịch Sử (1009 – 2026)</h3>
          <div class="timeline-list">
            ${window.TIMELINE_EVENTS.map(ev => `<div class="tl-item">
              <div class="tl-year">${ev.year}</div>
              <div class="tl-title">${ev.title}</div>
              <div class="tl-desc">${ev.desc}</div>
            </div>`).join("")}
          </div>
        </div>
      </div>

      <div class="bento-card">
        <h3 style="margin-bottom:12px;font-size:16px;">🌿 Danh Bạ Chi Nhánh & Thế Hệ</h3>
        <div class="branch-pills" id="s5Pills">
          ${branches.map(b => `<button class="branch-pill ${b === "ALL" ? "active" : ""}" onclick="filterS5Branch('${b}', this)">${b === "ALL" ? "Tất cả" : b}</button>`).join("")}
        </div>
        <div class="bento-members" id="s5Members"></div>
      </div>
    </div>`;

    document.getElementById("relA").value = "d1_tran_kinh";
    document.getElementById("relB").value = "d24_ngoc_anh";
    calcRelation();
    renderS5Members();
  }

  window.filterS5Branch = function (branch, btn) {
    s5BranchFilter = branch;
    document.querySelectorAll("#s5Pills .branch-pill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    renderS5Members();
  };

  function renderS5Members() {
    const list = s5BranchFilter === "ALL" ? window.MEMBERS : window.MEMBERS.filter(m => m.branch === s5BranchFilter);
    document.getElementById("s5Members").innerHTML = list.map(m => `
      <div class="bento-member-item" onclick="openMemberModal('${m.id}')">
        <div style="font-size:11px;color:#38bdf8;font-weight:700;">Đời ${m.gen} • ${m.branch}</div>
        <div style="font-weight:700;font-size:14.5px;margin:3px 0;">${m.name}</div>
        <div style="font-size:12px;opacity:0.75;">${m.location || m.role || (m.death ? "Mất: " + m.death : "Thành viên họ Trần")}</div>
      </div>
    `).join("");
  }

  window.calcRelation = function () {
    const idA = document.getElementById("relA").value;
    const idB = document.getElementById("relB").value;
    const getAncestors = (id) => {
      const path = [];
      let cur = membersById[id];
      while (cur) { path.push(cur); cur = cur.parentId ? membersById[cur.parentId] : null; }
      return path;
    };
    const pathA = getAncestors(idA);
    const pathB = getAncestors(idB);
    const setB = new Set(pathB.map(x => x.id));
    const lca = pathA.find(x => setB.has(x.id));
    const mA = membersById[idA], mB = membersById[idB];
    const diff = Math.abs(mA.gen - mB.gen);

    document.getElementById("relOutput").innerHTML = `
      <div><strong>Tổ tiên chung gần nhất:</strong> ${lca ? `${lca.name} (Đời ${lca.gen})` : "Không xác định"}</div>
      <div><strong>Khoảng cách thế hệ:</strong> ${diff === 0 ? "Cùng thế hệ (Đồng bối)" : `Cách nhau ${diff} đời`}</div>
      <div style="font-size:12px;opacity:0.85;margin-top:4px;">• ${mA.name} (Đời ${mA.gen}) cách Tổ chung ${pathA.indexOf(lca)} đời.<br>• ${mB.name} (Đời ${mB.gen}) cách Tổ chung ${pathB.findIndex(x => x.id === lca.id)} đời.</div>
    `;
  };

  // ----------------- TÌM KIẾM & MODAL CHI TIẾT -----------------
  const searchInput = document.getElementById("globalSearch");
  const searchResults = document.getElementById("searchResults");

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove("open"); return; }
    const hits = window.MEMBERS.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (m.location && m.location.toLowerCase().includes(q)) ||
      (m.spouses && m.spouses.some(s => s.name.toLowerCase().includes(q)))
    ).slice(0, 12);

    searchResults.innerHTML = hits.length
      ? hits.map(m => `<div class="search-item" onclick="selectSearchHit('${m.id}')">
          <span class="search-item-name">${m.name}</span>
          <span class="search-item-gen">Đời ${m.gen}</span>
        </div>`).join("")
      : `<div style="padding:10px;font-size:12.5px;opacity:0.7;">Không tìm thấy kết quả phù hợp.</div>`;
    searchResults.classList.add("open");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) searchResults.classList.remove("open");
  });

  window.selectSearchHit = function (id) {
    searchResults.classList.remove("open");
    openMemberModal(id);
    if (currentStyle === 2) s2FocusMember(id);
  };

  window.openMemberModal = function (id) {
    const m = membersById[id];
    if (!m) return;
    const parent = m.parentId ? membersById[m.parentId] : null;
    const kids = childrenById[m.id] || [];
    const spousesHtml = m.spouses && m.spouses.length
      ? m.spouses.map(s => `<div>• <strong>${s.name}</strong>${s.birth ? ` (Sinh: ${s.birth})` : ""}${s.death ? ` — Mất: ${s.death}` : ""}${s.note ? ` (${s.note})` : ""}</div>`).join("")
      : "Chưa ghi nhận trong phả";

    document.getElementById("modalContent").innerHTML = `
      <span class="modal-tag">ĐỜI THỨ ${m.gen} • ${m.branch}</span>
      <h2 class="modal-title">${m.name}</h2>
      <p style="font-size:13.5px;opacity:0.85;margin-bottom:12px;">${m.role || (m.isMainLine ? "Trực hệ truyền thừa chi Lãng Nam" : "Thành viên Phả Chi Họ Trần")}</p>
      <div class="modal-meta">
        <div class="meta-box"><div class="meta-lbl">Năm sinh / Năm mất</div><div class="meta-val">${m.birth ? "Sinh: " + m.birth : "—"} ${m.death ? "• Mất: " + m.death : ""} ${m.age ? "(" + m.age + ")" : ""}</div></div>
        <div class="meta-box"><div class="meta-lbl">Địa bàn / An táng</div><div class="meta-val">${m.location || "Làng Lãng Nam (Đồng Thái, Ninh Cường)"}</div></div>
      </div>
      <div class="meta-box" style="margin-bottom:12px;">
        <div class="meta-lbl">Phối ngẫu (Vợ / Chồng)</div>
        <div style="font-size:13px;line-height:1.6;margin-top:4px;">${spousesHtml}</div>
      </div>
      ${m.note ? `<div class="meta-box" style="margin-bottom:12px;"><div class="meta-lbl">Ghi chú phả ký</div><div style="font-size:13px;line-height:1.6;margin-top:4px;">${m.note}</div></div>` : ""}
      <div style="margin-top:12px;">
        <div class="meta-lbl">Thân phụ / Thân mẫu:</div>
        <div class="lineage-chips">
          ${parent ? `<span class="lineage-chip" onclick="openMemberModal('${parent.id}')">↑ ${parent.name} (Đời ${parent.gen})</span>` : `<span class="lineage-chip">Thủy Tổ Đời 1</span>`}
        </div>
      </div>
      ${kids.length ? `<div style="margin-top:12px;">
        <div class="meta-lbl">Con cái (${kids.length}):</div>
        <div class="lineage-chips">${kids.map(k => `<span class="lineage-chip" onclick="openMemberModal('${k.id}')">↓ ${k.name}</span>`).join("")}</div>
      </div>` : ""}
    `;
    document.getElementById("globalModal").classList.add("open");
  };

  window.openMemorialModal = function () {
    const items = [];
    window.MEMBERS.forEach(m => {
      if (m.death) items.push({ name: m.name, gen: `Đời ${m.gen}`, date: m.death, extra: m.age || "" });
      if (m.spouses) {
        m.spouses.forEach(s => {
          if (s.death) items.push({ name: s.name, gen: `Phối ngẫu Đời ${m.gen}`, date: s.death, extra: s.note || "" });
        });
      }
    });
    document.getElementById("modalContent").innerHTML = `
      <span class="modal-tag">LỊCH GIỖ TỔ TIÊN HỌ TRẦN</span>
      <h2 class="modal-title">Ngày Giỗ & Kỷ Niệm Âm Lịch</h2>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
        ${items.map(it => `<div class="meta-box" style="display:flex;justify-content:space-between;align-items:center;">
          <div><strong>${it.name}</strong><div style="font-size:11.5px;opacity:0.75;">${it.gen} ${it.extra ? "• " + it.extra : ""}</div></div>
          <span style="color:#fcd34d;font-weight:700;font-size:13px;">${it.date}</span>
        </div>`).join("")}
      </div>
    `;
    document.getElementById("globalModal").classList.add("open");
  };

  window.openOpenSourceModal = function () {
    document.getElementById("modalContent").innerHTML = `
      <span class="modal-tag">MÃ NGUỒN MỞ GITHUB TÍCH HỢP</span>
      <h2 class="modal-title">Kiến Trúc & Thư Viện Tham Chiếu</h2>
      <p style="font-size:13px;opacity:0.85;margin-bottom:14px;">Website Gia Phả Họ Trần Lãng Nam kế thừa và kết hợp tinh hoa từ các dự án mã nguồn mở phả hệ hàng đầu trên GitHub:</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${window.OPEN_SOURCE_REFS.map(r => `<div class="meta-box">
          <a href="${r.url}" target="_blank" rel="noopener" style="color:#38bdf8;font-weight:700;text-decoration:none;font-size:14px;">↗ ${r.name}</a>
          <div style="font-size:12.5px;opacity:0.85;margin-top:4px;line-height:1.5;">${r.role}</div>
        </div>`).join("")}
      </div>
    `;
    document.getElementById("globalModal").classList.add("open");
  };

  window.closeModal = function (e) {
    if (!e || e.target.id === "globalModal" || e.target.classList.contains("modal-close")) {
      document.getElementById("globalModal").classList.remove("open");
    }
  };

  // Khởi chạy theo URL hash hoặc Phong cách 1
  const match = window.location.hash.match(/style=(\d)/);
  const initialStyle = match ? Number(match[1]) : 1;
  switchStyle(initialStyle >= 1 && initialStyle <= 5 ? initialStyle : 1);
})();
