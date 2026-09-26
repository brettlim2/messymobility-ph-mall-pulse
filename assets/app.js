/* Signal & Footfall — interactive rendering. Vanilla JS + hand-rolled SVG. */
(function () {
  "use strict";
  var D = window.MALLPULSE;
  if (!D) { console.error("MALLPULSE data missing"); return; }
  var NS = "http://www.w3.org/2000/svg";
  var COL = {
    teal: "#00c4b0", tealPale: "#aee9e2", volt: "#bbff2b", coral: "#ff7a70",
    faint: "#5f7a76", mist: "#8fa8a3", wire: "#1c3833", border: "#2b453f",
    heading: "#f2f7f6", body: "#c3d4d1"
  };
  var TYPE_COL = { event: COL.teal, promo: COL.tealPale, organic: COL.faint };
  var tip = document.getElementById("tip");
  var state = { mall: "SM_North_EDSA", sel: null };

  // ---- helpers ------------------------------------------------------------
  function n(el, attrs, kids) {
    var e = document.createElementNS(NS, el);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function txt(el, attrs, s) { var e = n(el, attrs); e.textContent = s; return e; }
  function fmt(x) {
    if (x == null) return "—";
    if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
    if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k";
    return String(Math.round(x));
  }
  function fmtFull(x) { return x == null ? "—" : x.toLocaleString("en-US"); }
  function days(d) { return Date.parse(d) / 8.64e7; }
  function showTip(html, ev) {
    tip.innerHTML = html; tip.style.opacity = 1;
    tip.style.left = ev.clientX + "px"; tip.style.top = ev.clientY + "px";
  }
  function hideTip() { tip.style.opacity = 0; }

  // ---- KPIs ---------------------------------------------------------------
  function renderKPIs() {
    var k = D.kpis, wrap = document.getElementById("kpis");
    var standouts = D.posts.filter(function (p) { return p.verdict === "stands out (rare)"; }).length;
    var items = [
      ["Devices tracked", fmt(k.devices), "unique, 12 months"],
      ["Location pings", fmt(k.pings), "anonymised"],
      ["Posts scanned", fmtFull(k.posts_scanned), k.captioned_posts + " with captions"],
      ["Events scanned", fmtFull(k.events_scanned), "tagged activations"],
      ["Total engagement", fmt(k.total_engagement), "likes+comments+shares+views"],
      ["Posts that moved footfall", String(standouts), "stood out from noise", true]
    ];
    items.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "kpi" + (it[3] ? " signal" : "");
      d.innerHTML = '<div class="lab">' + it[0] + '</div><div class="val tnum">' +
        it[1] + '</div><div class="note">' + it[2] + '</div>';
      wrap.appendChild(d);
    });
  }

  // ---- Explorer -----------------------------------------------------------
  var EW = 760, EH = 330, EM = { t: 14, r: 14, b: 26, l: 44 };
  function explorerData() {
    var mall = state.mall;
    var d = D.daily.filter(function (r) { return r.mall === mall; })
      .sort(function (a, b) { return days(a.day) - days(b.day); });
    var byDay = {}; d.forEach(function (r) { byDay[r.day] = r; });
    var posts = D.posts.filter(function (p) { return p.mall === mall || p.mall === "Both"; });
    return { d: d, byDay: byDay, posts: posts };
  }
  function renderExplorer() {
    var box = document.getElementById("explorerChart");
    box.innerHTML = "";
    var ed = explorerData(), d = ed.d;
    if (!d.length) return;
    var x0 = days(d[0].day), x1 = days(d[d.length - 1].day);
    var ymax = Math.max.apply(null, d.map(function (r) { return r.shopper_visits; })) * 1.08;
    var sx = function (v) { return EM.l + (v - x0) / (x1 - x0) * (EW - EM.l - EM.r); };
    var sy = function (v) { return EH - EM.b - v / ymax * (EH - EM.t - EM.b); };
    var svg = n("svg", { viewBox: "0 0 " + EW + " " + EH, role: "img" });

    // gridlines + y labels
    for (var i = 0; i <= 4; i++) {
      var yv = ymax * i / 4, yy = sy(yv);
      svg.appendChild(n("line", { class: "gridline", x1: EM.l, x2: EW - EM.r, y1: yy, y2: yy }));
      svg.appendChild(txt("text", { class: "axlab", x: EM.l - 6, y: yy + 3, "text-anchor": "end" }, fmt(yv)));
    }
    // month ticks
    var seen = {};
    d.forEach(function (r) {
      var m = r.day.slice(0, 7);
      if (!seen[m]) {
        seen[m] = 1; var xx = sx(days(r.day));
        svg.appendChild(txt("text", { class: "axlab", x: xx, y: EH - 8, "text-anchor": "middle" }, r.day.slice(5, 7) + "/" + r.day.slice(2, 4)));
      }
    });
    // footfall line
    var path = d.map(function (r, i) { return (i ? "L" : "M") + sx(days(r.day)).toFixed(1) + " " + sy(r.shopper_visits).toFixed(1); }).join(" ");
    svg.appendChild(n("path", { class: "footline", d: path }));

    // post markers
    var maxEng = Math.max.apply(null, ed.posts.map(function (p) { return p.engagement; }) || [1]);
    ed.posts.forEach(function (p) {
      var row = ed.byDay[p.date];
      var yy = row ? sy(row.shopper_visits) : sy(ymax * 0.5);
      var r = 3 + Math.sqrt(p.engagement / (maxEng || 1)) * 9;
      var isBig = p.engagement === maxEng && maxEng > 0;
      var c = isBig ? COL.volt : (TYPE_COL[p.type] || COL.faint);
      var m = n("circle", {
        class: "pmark" + (state.sel && state.sel.id === p.id ? " sel" : ""),
        cx: sx(days(p.date)).toFixed(1), cy: yy.toFixed(1), r: r.toFixed(1),
        fill: c, "fill-opacity": 0.82, tabindex: 0, role: "button",
        "aria-label": (p.theme || p.type) + ", " + p.date
      });
      m.addEventListener("mouseenter", function (ev) {
        showTip("<b>" + (p.theme || p.type) + "</b><br>" + p.date + " · " + p.platform +
          "<br>engagement " + fmt(p.engagement) + " · " + p.verdict, ev);
      });
      m.addEventListener("mousemove", function (ev) { showTip(tip.innerHTML, ev); });
      m.addEventListener("mouseleave", hideTip);
      m.addEventListener("click", function () { selectPost(p); });
      m.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPost(p); } });
      svg.appendChild(m);
    });
    box.appendChild(svg);
  }

  function verdictClass(v) {
    if (v === "stands out (rare)") return "v-stand";
    if (v === "unusually quiet") return "v-quiet";
    return "v-normal";
  }
  function chipClass(v) {
    if (v === "stands out (rare)") return "stand";
    if (v === "unusually quiet") return "quiet";
    return "normal";
  }
  function sparkline(path, w, h) {
    var svg = n("svg", { viewBox: "0 0 " + w + " " + h });
    var vals = path.filter(function (x) { return x != null; });
    if (!vals.length) return svg;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pad = (mx - mn) * 0.15 || 1;
    var lo = mn - pad, hi = mx + pad;
    var sx = function (i) { return 4 + i / (path.length - 1) * (w - 8); };
    var sy = function (v) { return h - 4 - (v - lo) / (hi - lo) * (h - 8); };
    var dd = "", started = false;
    path.forEach(function (v, i) { if (v == null) return; dd += (started ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); started = true; });
    // day-0 marker line (index 7)
    svg.appendChild(n("line", { x1: sx(7), x2: sx(7), y1: 2, y2: h - 2, stroke: COL.border, "stroke-dasharray": "2 3" }));
    svg.appendChild(n("path", { d: dd, fill: "none", stroke: COL.teal, "stroke-width": 1.6 }));
    if (path[7] != null) svg.appendChild(n("circle", { cx: sx(7), cy: sy(path[7]), r: 3, fill: COL.volt }));
    return svg;
  }

  function selectPost(p) {
    state.sel = p; renderExplorer();
    var box = document.getElementById("detail");
    var liftTxt = p.lift_pct == null ? "" : (p.lift_pct > 0 ? "+" : "") + p.lift_pct + "% vs same-weekday avg";
    var zTxt = p.z == null ? "" : " · z = " + p.z;
    var vsub = p.verdict === "within normal range"
      ? "This day's footfall is inside normal same-weekday variation — indistinguishable from noise."
      : p.verdict === "unusually quiet"
        ? "Footfall was notably below a normal same-weekday (coincidental with the post, not caused by it)."
        : p.verdict === "stands out (rare)"
          ? "This day genuinely stands out from same-weekday variation."
          : "No footfall data for this date.";
    var html = '<div class="meta">' +
      '<span class="pill">' + p.platform + '</span>' +
      '<span class="pill">' + p.type + '</span>' +
      (p.event_start ? '<span class="pill">event ' + p.event_start + '</span>' : '') +
      '<span>' + p.date + '</span></div>' +
      '<h3>' + esc(p.theme || p.title || "(untitled post)") + '</h3>' +
      '<div class="mono" style="font-size:11px;color:var(--mist)">' + esc(p.author || "") +
      (p.venue ? ' · ' + esc(p.venue) : '') + (p.brand ? ' · ' + esc(p.brand) : '') + '</div>' +
      (embedHTML(p) ||
        (p.caption ? '<div class="caption">' + esc(p.caption) + '</div>'
                   : (p.summary ? '<div class="caption">' + esc(p.summary) + '</div>' : ''))) +
      '<div class="engrow"><span><b>' + fmt(p.likes) + '</b> likes</span><span><b>' + fmt(p.comments) +
      '</b> comments</span><span><b>' + fmt(p.shares) + '</b> shares</span><span><b>' + fmt(p.views) + '</b> views</span></div>' +
      '<div class="verdict ' + verdictClass(p.verdict) + '"><div class="vlab">Did footfall move?</div>' +
      '<div class="vval">' + p.verdict + '</div>' +
      '<div class="vsub">' + liftTxt + zTxt + '</div><div class="vsub">' + vsub + '</div>' +
      '<div class="spark" id="sp"></div></div>' +
      (p.url ? '<a class="srclink" href="' + escAttr(p.url) + '" target="_blank" rel="noopener nofollow">View original post ↗</a>' : '');
    box.innerHTML = html;
    var sp = box.querySelector("#sp");
    if (sp && p.path) { sp.appendChild(sparkline(p.path, 300, 60)); }
    box.querySelector(".vval").insertAdjacentHTML("afterend", '<div class="vsub mono" style="font-size:10px;letter-spacing:.08em">−7d ———— day 0 (post) ———— +7d</div>');
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }

  // Real embedded post via each platform's iframe embed (no third-party SDKs).
  function embedHTML(p) {
    var u = p.url || "", m;
    if (p.platform === "youtube") {
      m = u.match(/[?&]v=([^&]+)/) || u.match(/youtu\.be\/([^?&]+)/) || u.match(/shorts\/([^?&/]+)/);
      if (m) return frame("https://www.youtube.com/embed/" + m[1], 190, true);
    } else if (p.platform === "tiktok") {
      m = u.match(/\/video\/(\d+)/) || u.match(/\/(\d{6,})/);
      if (m) return frame("https://www.tiktok.com/embed/v2/" + m[1], 560);
    } else if (p.platform === "instagram") {
      m = u.match(/\/(?:p|reel|tv)\/([^\/?#]+)/);
      if (m) return frame("https://www.instagram.com/p/" + m[1] + "/embed", 500);
    } else if (p.platform === "facebook") {
      return frame("https://www.facebook.com/plugins/post.php?href=" +
        encodeURIComponent(u) + "&show_text=true&width=380", 520);
    }
    return "";
  }
  function frame(src, h, fs) {
    return '<iframe class="embed" style="height:' + h + 'px" src="' + escAttr(src) +
      '" loading="lazy" scrolling="no" frameborder="0"' +
      (fs ? ' allow="encrypted-media;picture-in-picture" allowfullscreen' : '') +
      '></iframe>';
  }

  // ---- Small multiples ----------------------------------------------------
  function renderSmall() {
    var g = document.getElementById("smgrid");
    var top = D.posts.slice().sort(function (a, b) { return b.engagement - a.engagement; }).slice(0, 10);
    top.forEach(function (p) {
      var card = document.createElement("div"); card.className = "sm";
      card.innerHTML = '<div class="t">' + esc(p.theme || "(post)") + '</div>' +
        '<div class="m">' + p.date + ' · ' + p.platform + ' · ' + fmt(p.engagement) + ' eng</div>';
      var sp = document.createElement("div");
      sp.appendChild(sparkline(p.path || [], 200, 56));
      card.appendChild(sp);
      var chip = document.createElement("span");
      chip.className = "chip " + chipClass(p.verdict);
      chip.textContent = p.verdict;
      card.appendChild(chip);
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        state.mall = (p.mall === "Both") ? state.mall : p.mall;
        syncMallSeg(); renderExplorer(); selectPost(p);
        document.getElementById("explorer").scrollIntoView({ behavior: "smooth" });
      });
      g.appendChild(card);
    });
  }

  // ---- Noise floor --------------------------------------------------------
  function renderFloor() {
    // Use SM shop10 device units from the MDE bundle for the illustration.
    var u = (D.mde.shop10 && D.mde.shop10.device_units && D.mde.shop10.device_units.SM_North_EDSA) || {};
    var level = u.mar_may_daily_level || 1281;
    var sd = Math.round(level * (u.resid_sd_pct || 22.6) / 100);
    var event = 100; // a sold-out concert at ~2% panel penetration
    var W = 360, H = 210, m = { t: 20, r: 16, b: 30, l: 16 };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
    var max = level + 2.5 * sd;
    var sy = function (v) { return H - m.b - v / max * (H - m.t - m.b); };
    var cx = W / 2;
    // noise band (level ± sd)
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(level + sd), height: sy(level - sd) - sy(level + sd), fill: COL.teal, "fill-opacity": 0.12 }));
    svg.appendChild(n("line", { x1: m.l, x2: W - m.r, y1: sy(level), y2: sy(level), stroke: COL.teal, "stroke-width": 1.4 }));
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: sy(level) - 6 }, "typical day ≈ " + fmt(level) + " shoppers"));
    svg.appendChild(txt("text", { class: "axlab", x: W - m.r, y: sy(level + sd) - 4, "text-anchor": "end", fill: COL.mist }, "±" + fmt(sd) + " day-to-day noise"));
    // event contribution arrow from level
    svg.appendChild(n("line", { x1: cx, x2: cx, y1: sy(level), y2: sy(level + event), stroke: COL.volt, "stroke-width": 2 }));
    svg.appendChild(n("circle", { cx: cx, cy: sy(level + event), r: 4, fill: COL.volt }));
    svg.appendChild(txt("text", { class: "axlab", x: cx + 8, y: sy(level + event) + 3, fill: COL.volt }, "big event ≈ +" + event + " devices"));
    document.getElementById("floorChart").appendChild(svg);

    // MDE table
    var t = document.getElementById("mdeTable");
    var rows = [["all visits", D.mde.visits], ["dwell ≥10 min", D.mde.shop10]];
    t.innerHTML = "<tr><th>Outcome</th><th>7-day campaign</th><th>Single day</th></tr>";
    rows.forEach(function (r) {
      var v = r[1] || {};
      t.innerHTML += "<tr><td>" + r[0] + "</td><td>" + (v.campaign7d_mde_share_lift_pct != null ? "±" + v.campaign7d_mde_share_lift_pct + "%" : "—") +
        "</td><td>" + (v.single_day_mde_share_lift_pct != null ? "±" + v.single_day_mde_share_lift_pct + "%" : "—") + "</td></tr>";
    });

    var standouts = D.posts.filter(function (p) { return p.verdict === "stands out (rare)"; }).length;
    document.getElementById("headline").innerHTML =
      "Across <b>" + D.posts.length + " captioned posts</b> — including sold-out concerts and " +
      "fan events with tens of thousands of engagements — <b>" + standouts + "</b> produced a " +
      "footfall day that stands out from normal same-weekday variation. The posts are real and " +
      "the crowds are real; the two just don't line up at the scale a location panel can measure.";
  }

  // ---- Changepoint (the exception) ---------------------------------------
  function renderChangepoint() {
    var segs = (D.changepoints.visits && D.changepoints.visits.segments) || [];
    if (!segs.length) return;
    var W = 720, H = 180, m = { t: 18, r: 16, b: 28, l: 40 };
    var x0 = days(segs[0].from), x1 = days(segs[segs.length - 1].to);
    var vals = segs.map(function (s) { return s.sm_share_pct; });
    var lo = Math.min.apply(null, vals) - 2, hi = Math.max.apply(null, vals) + 2;
    var sx = function (v) { return m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
    [lo, (lo + hi) / 2, hi].forEach(function (yv) {
      svg.appendChild(n("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) }));
      svg.appendChild(txt("text", { class: "axlab", x: m.l - 6, y: sy(yv) + 3, "text-anchor": "end" }, yv.toFixed(0) + "%"));
    });
    segs.forEach(function (s) {
      svg.appendChild(n("line", { x1: sx(days(s.from)), x2: sx(days(s.to)), y1: sy(s.sm_share_pct), y2: sy(s.sm_share_pct), stroke: COL.teal, "stroke-width": 2.4 }));
      var mid = (days(s.from) + days(s.to)) / 2;
      svg.appendChild(txt("text", { class: "axlab", x: sx(mid), y: sy(s.sm_share_pct) - 8, "text-anchor": "middle", fill: COL.heading }, s.sm_share_pct + "%"));
      svg.appendChild(txt("text", { class: "axlab", x: sx(mid), y: H - 8, "text-anchor": "middle" }, s.from.slice(0, 7)));
    });
    // volt marker on the renovation shift
    if (segs.length > 1) {
      svg.appendChild(n("circle", { cx: sx(days(segs[1].from)), cy: sy(segs[1].sm_share_pct), r: 4, fill: COL.volt }));
    }
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: 12, fill: COL.mist }, "SM North share of the two-mall panel"));
    document.getElementById("cpChart").appendChild(svg);
  }

  // ---- Who visits ---------------------------------------------------------
  function renderWho() {
    var bands = (D.catchment && D.catchment.by_distance_band) || [];
    if (bands.length) {
      var W = 360, H = 200, m = { t: 10, r: 16, b: 34, l: 40 };
      var max = Math.max.apply(null, bands.map(function (b) { return b.reach_pct; })) * 1.1;
      var bw = (W - m.l - m.r) / bands.length;
      var sy = function (v) { return H - m.b - v / max * (H - m.t - m.b); };
      var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
      bands.forEach(function (b, i) {
        var x = m.l + i * bw + bw * 0.18, w = bw * 0.64;
        svg.appendChild(n("rect", { x: x, width: w, y: sy(b.reach_pct), height: H - m.b - sy(b.reach_pct), fill: i === 0 ? COL.volt : COL.teal, "fill-opacity": i === 0 ? 0.9 : 0.7, rx: 2 }));
        svg.appendChild(txt("text", { class: "axlab", x: x + w / 2, y: sy(b.reach_pct) - 4, "text-anchor": "middle", fill: COL.body }, b.reach_pct + "%"));
        svg.appendChild(txt("text", { class: "axlab", x: x + w / 2, y: H - 18, "text-anchor": "middle" }, b.band));
      });
      svg.appendChild(txt("text", { class: "axlab", x: m.l, y: H - 4, fill: COL.faint }, "home distance from mall"));
      document.getElementById("reachChart").appendChild(svg);
    }
    var cm = D.cross_mall || {}, gaps = cm.by_gap_ceiling || [];
    var g60 = gaps.filter(function (r) { return r.gap_ceiling_min === 60; })[0] || gaps[1] || {};
    var cont = cm.pathing_continuity_le60min || {};
    var el = document.getElementById("crossStats");
    el.innerHTML =
      stat(fmtFull(g60.candidate_transfers), "candidate same-visit SM↔TriNoma transfers", "consecutive, non-overlapping, ≤60 min apart") +
      stat((cont.pct != null ? cont.pct + "%" : "—"), "corroborated by movement", "have an intervening approach ping between malls") +
      '<p style="font-size:12px;color:var(--mist);margin-top:12px">The two malls face each other across ' +
      'EDSA, so a large minority of visitors touch both in one trip — the clearest chaining this ' +
      'two-mall panel can show.</p>';
  }
  function stat(v, lab, sub) {
    return '<div style="padding:10px 0;border-bottom:1px solid var(--wire)">' +
      '<div class="mono" style="font-size:24px;color:var(--heading);font-weight:600">' + v + '</div>' +
      '<div style="font-size:12.5px;color:var(--body);margin-top:2px">' + lab + '</div>' +
      '<div style="font-size:11px;color:var(--faint)">' + sub + '</div></div>';
  }

  // ---- footer -------------------------------------------------------------
  function renderFooter() {
    var m = D.meta;
    document.getElementById("footmeta").innerHTML =
      '<b>Signal &amp; Footfall</b> — a MessyMobility sample surface. ' +
      'Footfall window ' + m.footfall_window[0] + " → " + m.footfall_window[1] +
      '; posts ' + m.post_window[0] + " → " + m.post_window[1] + '.<br>' +
      '<b>What this can show:</b> catchment, audience composition, cross-mall behaviour, and whether an event stands out from noise. ' +
      '<b>What it cannot:</b> absolute footfall, post-level attribution below the noise floor, or population-level claims.';
  }

  // ---- wiring -------------------------------------------------------------
  function syncMallSeg() {
    document.querySelectorAll("#mallseg button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.mall === state.mall ? "true" : "false");
    });
  }
  document.getElementById("mallseg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.mall = b.dataset.mall; state.sel = null; syncMallSeg();
    document.getElementById("detail").innerHTML = '<div class="empty">Select a post dot to inspect it.</div>';
    renderExplorer();
  });
  window.addEventListener("resize", function () { /* SVG is viewBox-scaled; nothing to do */ });

  renderKPIs();
  renderExplorer();
  renderSmall();
  renderFloor();
  renderChangepoint();
  renderWho();
  renderFooter();
})();
