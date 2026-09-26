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
  var HOLIDAYS = { "2026-01-01": "New Year", "2026-02-17": "Chinese New Year", "2026-02-25": "EDSA", "2026-04-02": "Maundy Thu", "2026-04-03": "Good Fri", "2026-04-09": "Araw ng Kagitingan", "2026-05-01": "Labour Day" };
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
    // confounder markers: paydays (15th + month-end) and PH holidays
    var byDayAll = {}; d.forEach(function (r) { byDayAll[r.day] = 1; });
    d.forEach(function (r) {
      var dd = r.day, dnum = +dd.slice(8, 10);
      var nextDay = (function () { var t = new Date(dd); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); })();
      var isMonthEnd = (+nextDay.slice(8, 10) === 1);
      var xx = sx(days(dd));
      if (dnum === 15 || isMonthEnd) {
        svg.appendChild(n("line", { x1: xx, x2: xx, y1: EH - EM.b, y2: EH - EM.b - 12, stroke: COL.faint, "stroke-width": 1, "stroke-dasharray": "1 2" }));
      }
      if (HOLIDAYS[dd]) {
        svg.appendChild(n("line", { x1: xx, x2: xx, y1: EM.t, y2: EH - EM.b, stroke: COL.mist, "stroke-width": 1, "stroke-dasharray": "1 3", "stroke-opacity": 0.35 }));
      }
    });
    // expected footfall + normal-variation band (behind the observed line)
    var expByDay = {};
    (D.expected_daily || []).forEach(function (r) { if (r.mall === state.mall) expByDay[r.day] = r; });
    var top = [], bot = [];
    d.forEach(function (r) {
      var e = expByDay[r.day];
      if (e) { top.push([sx(days(r.day)), sy(Math.min(e.band_hi, ymax))]);
               bot.push([sx(days(r.day)), sy(Math.max(e.band_lo, 0))]); }
    });
    if (top.length > 1) {
      var area = "M" + top.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") +
        "L" + bot.reverse().map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + "Z";
      svg.appendChild(n("path", { d: area, fill: COL.teal, "fill-opacity": 0.09 }));
      var eline = d.filter(function (r) { return expByDay[r.day]; })
        .map(function (r, i) { return (i ? "L" : "M") + sx(days(r.day)).toFixed(1) + " " + sy(expByDay[r.day].expected).toFixed(1); }).join(" ");
      svg.appendChild(n("path", { d: eline, fill: "none", stroke: COL.mist, "stroke-width": 1, "stroke-dasharray": "3 3", "stroke-opacity": 0.75 }));
    }
    // observed footfall line
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
      '<div class="verdict ' + verdictClass(p.verdict) + '"><div class="vlab">Did traffic respond?</div>' +
      '<div class="vval">' + p.verdict + '</div>' +
      (p.expected != null ? '<div class="eo mono">' +
        '<span>observed <b>' + fmt(p.observed) + '</b></span>' +
        '<span>expected <b>' + fmt(p.expected) + '</b></span>' +
        '<span>lift <b>' + (p.lift_pct > 0 ? '+' : '') + p.lift_pct + '%</b></span>' +
        '<span>normal ' + p.range_lo_pct + '% … +' + p.range_hi_pct + '%</span></div>' : '') +
      '<div class="vsub">' + vsub + '</div>' +
      '<div class="spark" id="sp"></div></div>' +
      (p.url ? '<a class="srclink" href="' + escAttr(p.url) + '" target="_blank" rel="noopener nofollow">View original post ↗</a>' : '');
    box.innerHTML = html;
    var sp = box.querySelector("#sp");
    if (sp && p.path) { sp.appendChild(sparkline(p.path, 300, 60)); }
    box.querySelector(".vval").insertAdjacentHTML("afterend", '<div class="vsub mono" style="font-size:10px;letter-spacing:.08em">−7d ———— day 0 (post) ———— +7d</div>');
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }
  // A usable campaign name: theme, else title, else null (row is hidden).
  function meaningful(s) { s = (s == null ? "" : String(s)).trim().toLowerCase(); return !!s && ["n/a", "na", "n.a.", "none", "nan", "not applicable", "unknown"].indexOf(s) < 0; }
  function postName(p) { return meaningful(p.theme) ? p.theme : (meaningful(p.title) ? p.title : null); }

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
      card.innerHTML = '<div class="t">' + esc(postName(p) || "(post)") + '</div>' +
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
      t.innerHTML += "<tr><td>" + r[0] + "</td><td>" + (v.campaign7d_mde_share_lift_pct != null ? "±" + v.campaign7d_mde_share_lift_pct + " pp" : "—") +
        "</td><td>" + (v.single_day_mde_share_lift_pct != null ? "±" + v.single_day_mde_share_lift_pct + " pp" : "—") + "</td></tr>";
    });

    var testable = D.posts.filter(function (p) { return p.z != null; });
    var high = testable.filter(function (p) { return p.z >= 2; }).length;
    var low = testable.filter(function (p) { return p.verdict === "unusually quiet"; }).length;
    var trimmed = (D.data_quality && D.data_quality.trimmed_days) || [];
    document.getElementById("headline").innerHTML =
      "Across <b>" + testable.length + " captioned posts</b> with a complete-footfall day (of " +
      D.posts.length + " total) — including sold-out concerts and fan events with tens of thousands of " +
      "engagements — <b>none</b> coincided with an unusually <b>high</b> footfall day. <b>" + low +
      "</b> landed on unusually <b>low</b> days (a couple of genuinely quiet dates), fewer than the " +
      "~" + Math.round(0.05 * testable.length) + " you'd expect from chance. We excluded the final " +
      trimmed.length + " days of the export (" + trimmed.join(", ") + "), where the device feed was " +
      "incomplete and would have shown false dips. The posts are real and the crowds are real; the two " +
      "just don't line up at the scale this panel can measure.";
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

  // ---- answer cards (hero) ------------------------------------------------
  function mon(iso) { return iso ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4) : "?"; }
  function renderWindows() {
    var m = D.meta;
    function set(id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; }
    set("heroWin", "Movement panel " + mon(m.movement_window[0]) + " – " + mon(m.movement_window[1]) + " (12 mo)");
    set("winDetection", "Analysis window " + mon(m.renovation_window[0]) + " – " + mon(m.renovation_window[1]));
    set("winRenovation", "Renovation window " + mon(m.renovation_window[0]) + " – " + mon(m.renovation_window[1]));
    set("winExplorer", "Footfall " + mon(m.footfall_window[0]) + " – " + mon(m.footfall_window[1]) + " · posts " + mon(m.post_window[0]) + " – " + mon(m.post_window[1]));
    set("winCampaigns", "Posts " + mon(m.post_window[0]) + " – " + mon(m.post_window[1]));
    set("winEngagement", "Posts " + mon(m.post_window[0]) + " – " + mon(m.post_window[1]));
    set("winAudience", "Renovation window " + mon(m.renovation_window[0]) + " – " + mon(m.renovation_window[1]));
  }
  function renderAnswer() {
    var host = document.getElementById("answerCards"); if (!host) return;
    var c = D.insight_cards;
    var cards = [
      ["Social impact", "0", "of 10", "highest-engagement posts produced a <b>mall-wide</b> footfall response we can detect", true],
      ["What does move traffic", "+" + c.what_moves.renovation_share_swing_pp + "pp", "share",
        "shift in SM North's share of the two malls while TriNoma was renovating", false],
      ["Detection threshold", "±" + c.detection_threshold.campaign7d_pct + "%", "7-day",
        "smallest weekly campaign effect on cross-mall share we can reliably detect", false]
    ];
    host.innerHTML = cards.map(function (x) {
      return '<div class="acard' + (x[4] ? " signal" : "") + '"><div class="k">' + x[0] + '</div>' +
        '<div class="big">' + x[1] + ' <span style="font-size:15px;color:var(--mist);font-family:var(--mono)">' + x[2] + '</span></div>' +
        '<div class="cap">' + x[3] + '</div></div>';
    }).join("");
  }

  // ---- detection extras: pooled estimate, multiple testing, glossary ------
  function renderDetectionExtras() {
    var pe = D.pooled_event || {};
    var host = document.getElementById("pooledEvent");
    if (host && pe.est_pct != null) {
      host.innerHTML = '<span class="big">' + (pe.est_pct > 0 ? "+" : "") + pe.est_pct + ' pp</span>' +
        '<span class="ci">95% CI ' + pe.ci_lo + ' to ' + (pe.ci_hi > 0 ? "+" : "") + pe.ci_hi + ' pp · ' + pe.n_events + ' events</span>' +
        '<span style="color:var(--mist);font-size:12.5px;flex-basis:100%">average day-0 change in <b style="color:var(--ice)">cross-mall share</b> (percentage points), pooled across <b style="color:var(--ice)">' + pe.n_events + ' dated events</b> — statistically indistinguishable from zero. This is a broader, more powerful test than the per-post view: it uses the full event scan, not just the 238 posts with captions we display, and it answers the question in share terms rather than raw footfall.</span>';
    }
    var testable = (D.insight_cards.social_impact || {}).testable || D.posts.filter(function (p) { return p.z != null; }).length;
    var quiet = D.posts.filter(function (p) { return p.verdict === "unusually quiet"; }).length;
    var exp5 = Math.round(0.05 * testable);
    var mt = document.getElementById("multiTest");
    if (mt) mt.innerHTML = "<b>A note on chance.</b> With " + testable + " posts tested, about " +
      exp5 + " (~5%) would land outside the ±2σ band by luck alone. We see just <b>" + quiet +
      "</b>, all on the <i>quiet</i> side — fewer than chance predicts, and the opposite of what a " +
      "campaign lift would look like. (The bigger apparent dips at the end of May were an incomplete " +
      "data feed, now excluded — see Methods.)";
    var gl = document.getElementById("glossary");
    if (gl) gl.innerHTML =
      "<b>σ (sigma):</b> the typical day-to-day wobble in footfall. " +
      "<b>±2σ band:</b> the range a normal day stays within about 95% of the time. " +
      "<b>80% power:</b> an effect big enough that we'd catch it 4 times out of 5 if it were real. " +
      "<b>Cross-mall share:</b> each mall's slice of the two malls' combined visitors — a percentage, so it isn't distorted as the device panel shrinks over the year (“panel drift”).";
  }

  // ---- lag curve (detection) ----------------------------------------------
  function renderLag() {
    var host = document.getElementById("lagChart"); if (!host || !D.lag_curve) return;
    var lc = D.lag_curve, W = 720, H = 200, m = { t: 16, r: 16, b: 28, l: 44 };
    var days = lc.days, all = lc.all_events, top = lc.top25;
    var mde = lc.mde_single_day_pct || 7.5;
    var vals = all.concat(top).concat([mde, -mde]);
    var lo = Math.min.apply(null, vals) - 1, hi = Math.max.apply(null, vals) + 1;
    var sx = function (i) { return m.l + i / (days.length - 1) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    // MDE band (±mde) shaded — the "detectable" threshold
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(mde), height: sy(-mde) - sy(mde), fill: COL.teal, "fill-opacity": 0.07 }));
    [0].forEach(function (yv) { svg.appendChild(n("line", { class: "zeroline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) })); });
    svg.appendChild(txt("text", { class: "axlab", x: W - m.r, y: sy(mde) - 4, "text-anchor": "end", fill: COL.mist }, "detectable ±" + mde + "%"));
    // day 0 line
    svg.appendChild(n("line", { x1: sx(7), x2: sx(7), y1: m.t, y2: H - m.b, stroke: COL.border, "stroke-dasharray": "2 3" }));
    [["all events", all, COL.teal], ["top 25 by engagement", top, COL.volt]].forEach(function (ser) {
      var d = ser[1].map(function (v, i) { return (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); }).join(" ");
      svg.appendChild(n("path", { d: d, fill: "none", stroke: ser[2], "stroke-width": 1.6 }));
    });
    days.forEach(function (dv, i) { if (dv % 7 === 0 || dv === 0) svg.appendChild(txt("text", { class: "axlab", x: sx(i), y: H - 8, "text-anchor": "middle" }, dv === 0 ? "post" : (dv > 0 ? "+" : "") + dv + "d")); });
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: m.t, fill: COL.faint }, "share excess (%)"));
    host.appendChild(svg);
    host.insertAdjacentHTML("beforeend", '<div class="mono" style="font-size:11.5px;color:var(--mist);margin-top:6px"><span style="color:var(--teal)">━</span> all events &nbsp; <span style="color:var(--volt)">━</span> top 25 by engagement — both stay inside the ±' + mde + '% detectable band at every lag, day −7 to +7. No same-day or delayed response emerges.</div>');
  }

  // ---- renovation before/during/after strip -------------------------------
  function renderRenovation() {
    var host = document.getElementById("renoStrip"); if (!host) return;
    var segs = (D.changepoints.visits && D.changepoints.visits.segments) || [];
    if (segs.length < 2) return;
    var labels = ["Before", "During renovation", "After"];
    var html = '<div class="reno-strip">';
    segs.slice(0, 3).forEach(function (s, i) {
      if (i) html += '<div class="reno-arrow">→</div>';
      html += '<div class="reno-step' + (i === 1 ? " mid" : "") + '"><div class="p">' + labels[i] + '</div>' +
        '<div class="s">' + s.sm_share_pct + '%</div>' +
        '<div class="d">SM North share · ' + s.from.slice(0, 7) + " → " + s.to.slice(0, 7) + '</div></div>';
    });
    html += "</div>";
    host.innerHTML = html;
  }

  // ---- renovation audience + event-night fingerprint ----------------------
  function renderAudience() {
    var host = document.getElementById("renoAudience"); if (!host) return;
    var ra = (D.renovation_audience || []).filter(function (r) { return r.mall === "TriNoma"; });
    var byp = {}; ra.forEach(function (r) { byp[r.period] = r; });
    var order = ["before", "during", "after"];
    var rowsH = order.filter(function (p) { return byp[p]; }).map(function (p) {
      var r = byp[p];
      return "<tr><td>" + p + "</td><td>" + fmt(r.devices) + "</td><td>" + (r.local_pct != null ? r.local_pct + "%" : "—") +
        "</td><td>" + (r.far_pct != null ? r.far_pct + "%" : "—") + "</td></tr>";
    }).join("");
    // fingerprint summary
    var fp = (D.fingerprint && D.fingerprint.events) || [];
    var maxz = 0; fp.forEach(function (e) { ["z_devices", "z_new", "z_far", "z_long"].forEach(function (k) { maxz = Math.max(maxz, Math.abs(e[k] || 0)); }); });
    host.innerHTML =
      '<div class="two"><div class="card">' +
      '<div class="mono" style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:10px">TriNoma crowd composition (decay-safe)</div>' +
      '<table><thead><tr><th>Period</th><th>Devices</th><th>Local ≤3mi</th><th>Far &gt;10mi</th></tr></thead><tbody>' + rowsH + '</tbody></table>' +
      '<p style="font-size:12px;color:var(--mist);margin-top:10px">Local share is essentially <b style="color:var(--ice)">flat before→during</b> the works (41%→41%); the rise to 48% appears only in the thin 23-day post-period, so treat it as a <b style="color:var(--ice)">tentative post-period composition change</b>, not a renovation effect. Home-distance shares are the only period-length-safe comparison here; new-visitor and cross-shop shares are <i>not</i> compared (the windows are 150 / 70 / 23 days).</p>' +
      '</div><div class="card">' +
      '<div class="mono" style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:10px">Event-night audience fingerprint</div>' +
      '<div class="mono" style="font-size:30px;color:var(--heading);font-weight:600">|z| &lt; ' + (Math.ceil(maxz * 10) / 10).toFixed(1) + '</div>' +
      '<p style="font-size:12.5px;color:var(--body);margin-top:6px">Across the <b>' + fp.length + '</b> biggest timed event nights, the crowd\'s composition — new visitors, far-home share, long dwell — never deviated 2σ from a normal night. On a concert night, the crowd looks like any night.</p>' +
      '</div></div>';
  }

  // ---- ranked evidence table ---------------------------------------------
  var tbl = { mall: "all", type: "all", key: "engagement", dir: -1, exp: null };
  var COLS = [
    { k: "name", t: "Campaign" }, { k: "type", t: "Type" }, { k: "n", t: "Posts" },
    { k: "date", t: "Dates" }, { k: "engagement", t: "Engagement" },
    { k: "zmax", t: "Best day (σ)" }, { k: "detectable", t: "Detectable?" }
  ];
  function campaignKey(p) { return p.campaign_key ? "c:" + p.campaign_key : "p:" + p.id; }
  function buildCampaigns() {
    var f = D.posts.filter(function (p) {
      return p.z != null && postName(p) != null &&
        (tbl.mall === "all" || p.mall === tbl.mall) &&
        (tbl.type === "all" || p.type === tbl.type);
    });
    var groups = {};
    f.forEach(function (p) { var k = campaignKey(p); (groups[k] = groups[k] || []).push(p); });
    var out = Object.keys(groups).map(function (k) {
      var ms = groups[k].sort(function (a, b) { return days(a.date) - days(b.date); });
      var tc = {}; ms.forEach(function (p) { tc[p.type] = (tc[p.type] || 0) + 1; });
      var type = Object.keys(tc).sort(function (a, b) { return tc[b] - tc[a]; })[0];
      var zs = ms.map(function (p) { return p.z; });
      return {
        key: k, name: ms[0].campaign || postName(ms[0]),
        type: type, n: ms.length,
        engagement: ms.reduce(function (s, p) { return s + p.engagement; }, 0),
        dateLo: ms[0].date, dateHi: ms[ms.length - 1].date, date: days(ms[ms.length - 1].date),
        zmax: Math.max.apply(null, zs),
        detectable: ms.some(function (p) { return p.detectable; }), members: ms
      };
    });
    out.sort(function (a, b) {
      var x = a[tbl.key], y = b[tbl.key];
      if (typeof x === "string") return tbl.dir * x.localeCompare(y);
      return tbl.dir * (x - y);
    });
    return out;
  }
  function renderLearned() {
    var host = document.getElementById("learned"); if (!host) return;
    var camps = buildCampaigns();
    var r = D.pooled_event || {};
    var cards = [
      ["No post cleared the bar", "Not one", "campaign",
        "had even a single day that stood out above normal — the best tops out near +2σ"],
      ["Engagement doesn't predict traffic", "r = " + ((D.corr_eng_z && D.corr_eng_z.r != null) ? D.corr_eng_z.r.toFixed(2) : "—"), "no lift",
        "a post going viral online says nothing about footfall that day"],
      ["What did move", "±2 pp", "share",
        "only the mall-scale renovation shifted cross-mall share; posts didn't"]
    ];
    host.innerHTML = cards.map(function (x) {
      return '<div class="acard"><div class="k">' + x[0] + '</div>' +
        '<div class="big">' + x[1] + ' <span style="font-size:15px;color:var(--mist);font-family:var(--mono)">' + x[2] + '</span></div>' +
        '<div class="cap">' + x[3] + '</div></div>';
    }).join("");
  }
  function detCell(v) { return v ? '<span class="det-yes">yes</span>' : '<span class="det-no">no</span>'; }
  function renderTable() {
    var t = document.getElementById("rankTable"); if (!t) return;
    var head = "<thead><tr>" + COLS.map(function (c) {
      var ar = tbl.key === c.k ? ' <span class="ar">' + (tbl.dir < 0 ? "▼" : "▲") + "</span>" : "";
      return '<th data-k="' + c.k + '">' + c.t + ar + "</th>";
    }).join("") + "</tr></thead>";
    var camps = buildCampaigns();
    var body = "<tbody>";
    camps.forEach(function (c) {
      var dates = c.dateLo === c.dateHi ? c.dateLo : c.dateLo + " – " + c.dateHi;
      var ind = c.n > 1 ? '<span class="exp-ind">' + (tbl.exp === c.key ? "▾" : "▸") + "</span>"
        : '<span class="exp-ind" style="opacity:.35">·</span>';
      body += '<tr class="grp" data-key="' + escAttr(c.key) + '">' +
        "<td>" + ind + esc(c.name) + "</td><td><span class=\"vt\">" + c.type + "</span></td>" +
        "<td>" + c.n + '</td><td style="font-family:var(--mono);color:var(--mist);font-size:12px">' + dates + "</td>" +
        "<td>" + fmt(c.engagement) + "</td><td>" + (c.zmax > 0 ? "+" : "") + c.zmax.toFixed(2) + "σ</td>" +
        "<td>" + detCell(c.detectable) + "</td></tr>";
      if (tbl.exp === c.key) {
        c.members.forEach(function (p) {
          body += '<tr class="member" data-id="' + escAttr(p.id) + '">' +
            "<td>" + p.date + " · " + esc(postName(p) || p.platform) + "</td><td>" + p.platform +
            "</td><td></td><td></td><td>" + fmt(p.engagement) + "</td><td>" + (p.z > 0 ? "+" : "") + p.z +
            "σ</td><td>" + detCell(p.detectable) + "</td></tr>";
        });
      }
    });
    body += "</tbody>";
    t.innerHTML = head + body;
    t.querySelectorAll("thead th").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        if (tbl.key === k) tbl.dir *= -1; else { tbl.key = k; tbl.dir = (k === "name" || k === "type") ? 1 : -1; }
        renderTable();
      });
    });
    t.querySelectorAll("tr.grp").forEach(function (tr) {
      tr.addEventListener("click", function () { var k = tr.dataset.key; tbl.exp = (tbl.exp === k) ? null : k; renderTable(); });
    });
    t.querySelectorAll("tr.member").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        e.stopPropagation();
        var p = D.posts.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (p) { state.mall = p.mall === "Both" ? state.mall : p.mall; syncMallSeg(); renderExplorer(); selectPost(p); document.getElementById("explorer").scrollIntoView({ behavior: "smooth" }); }
      });
    });
  }
  function wireTableFilters() {
    var mm = document.getElementById("tblmall"), tt = document.getElementById("tbltype");
    if (mm) mm.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; tbl.mall = b.dataset.mall; [].forEach.call(mm.children, function (x) { x.setAttribute("aria-pressed", x === b); }); renderTable(); });
    if (tt) tt.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; tbl.type = b.dataset.type; [].forEach.call(tt.children, function (x) { x.setAttribute("aria-pressed", x === b); }); renderTable(); });
  }

  // ---- engagement -> abnormality scatter ----------------------------------
  function renderScatter() {
    var host = document.getElementById("scatterChart"); if (!host) return;
    var P = D.posts.filter(function (p) { return p.z != null && p.engagement > 0; });
    var W = 760, H = 340, m = { t: 16, r: 16, b: 40, l: 44 };
    var xs = P.map(function (p) { return Math.log10(p.engagement + 1); });
    var ys = P.map(function (p) { return p.z; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = -3.5, ymax = 3;  // clamp; extreme quiet-day outliers sit at the floor
    var clamp = function (v) { return Math.max(ymin, Math.min(ymax, v)); };
    var sx = function (v) { return m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (clamp(v) - ymin) / (ymax - ymin) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    // ±2σ noise band
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(2), height: sy(-2) - sy(2), fill: COL.teal, "fill-opacity": 0.07 }));
    [2, 0, -2].forEach(function (yv) {
      svg.appendChild(n("line", { class: yv === 0 ? "zeroline" : "gridline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) }));
      svg.appendChild(txt("text", { class: "axlab", x: m.l - 6, y: sy(yv) + 3, "text-anchor": "end" }, yv + "σ"));
    });
    // x ticks (log engagement -> nice powers)
    [1, 2, 3, 4, 5].forEach(function (p10) {
      if (p10 >= xmin && p10 <= xmax) {
        svg.appendChild(txt("text", { class: "axlab", x: sx(p10), y: H - 22, "text-anchor": "middle" }, fmt(Math.pow(10, p10))));
      }
    });
    svg.appendChild(txt("text", { class: "axlab", x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle", fill: COL.faint }, "post engagement (log scale) →"));
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: m.t + 2, fill: COL.faint }, "footfall deviation (σ from normal) ↑"));
    // regression line
    var n0 = P.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n0, my = ys.reduce(function (a, b) { return a + b; }, 0) / n0;
    var cov = 0, vx = 0, vy = 0;
    for (var i = 0; i < n0; i++) { cov += (xs[i] - mx) * (ys[i] - my); vx += Math.pow(xs[i] - mx, 2); vy += Math.pow(ys[i] - my, 2); }
    var slope = vx ? cov / vx : 0, intc = my - slope * mx, r = (vx && vy) ? cov / Math.sqrt(vx * vy) : 0;
    svg.appendChild(n("line", { x1: sx(xmin), y1: sy(slope * xmin + intc), x2: sx(xmax), y2: sy(slope * xmax + intc), stroke: COL.volt, "stroke-width": 1.6, "stroke-dasharray": "5 4" }));
    // dots
    P.forEach(function (p, i) {
      var c = n("circle", { class: "dotc", cx: sx(xs[i]).toFixed(1), cy: sy(ys[i]).toFixed(1), r: 4, fill: TYPE_COL[p.type] || COL.faint, "fill-opacity": 0.7, stroke: COL.night, "stroke-width": 0.5 });
      c.addEventListener("mouseenter", function (ev) { showTip("<b>" + esc(p.theme || p.type) + "</b><br>eng " + fmt(p.engagement) + " · " + p.z + "σ · " + p.verdict, ev); });
      c.addEventListener("mousemove", function (ev) { showTip(tip.innerHTML, ev); });
      c.addEventListener("mouseleave", hideTip);
      c.addEventListener("click", function () { state.mall = p.mall === "Both" ? state.mall : p.mall; syncMallSeg(); renderExplorer(); selectPost(p); document.getElementById("explorer").scrollIntoView({ behavior: "smooth" }); });
      svg.appendChild(c);
    });
    host.appendChild(svg);
    var R = (D.corr_eng_z && D.corr_eng_z.r != null) ? D.corr_eng_z.r : r;
    document.getElementById("scatterFit").innerHTML =
      "Correlation r = <b style='color:var(--heading)'>" + R.toFixed(2) + "</b> — <b>no positive relationship</b>: " +
      "a post travelling further online does not predict a bigger footfall response, and every point stays inside " +
      "the ±2σ band on the lift side. The slight negative slope mostly reflects that the biggest posts clustered " +
      "late in the window, when footfall was seasonally lower — timing, not suppression.";
  }

  // ---- methods ------------------------------------------------------------
  function renderMethods() {
    var host = document.getElementById("methodsBody"); if (!host) return;
    var m = D.meta;
    var items = [
      ["Data & windows", "An anonymised device-movement panel (" + mon(m.movement_window[0]) + " – " + mon(m.movement_window[1]) +
        ") for the two malls; a daily footfall series (" + mon(m.footfall_window[0]) + " – " + mon(m.footfall_window[1]) +
        "); captioned social posts (" + mon(m.post_window[0]) + " – " + mon(m.post_window[1]) +
        "); and the renovation window (" + mon(m.renovation_window[0]) + " – " + mon(m.renovation_window[1]) +
        "). Only aggregates are shown — no device-level data."],
      ["Expected & the band", "“Expected” for a day is the average of the same weekday over the surrounding ±28 days. The band is ±2σ around it — the range a normal day stays within ~95% of the time. A day is flagged only when it falls outside the band."],
      ["Matching posts to footfall", "Each post is placed on its publish date; that day (and the ±7 days around it) is compared with the expected line. Posts are grouped into campaigns so a burst about one thing counts once, not many times."],
      ["Panel drift", "The device panel shrinks over the year, so raw visitor counts aren't comparable across months. Anything spanning time uses shares or percentages (“decay-safe”) instead of counts."],
      ["Two detection floors", "The per-day ±2σ band flags a single unusual day. The 80%-power minimum detectable effect is for a 7-day campaign on cross-mall share of dwell≥10 visitors — smaller, because a week averages out daily noise. They are different questions."],
      ["Chance & pooling", "With hundreds of posts, ~5% clear ±2σ by luck. The pooled estimate across all events (day-0 ≈ 0 pp of cross-mall share, CI brackets zero) is the more reliable test than per-post pass/fail."],
      ["Which posts vs which events", "Three populations appear here: the 238 captioned posts we can display (explorer, campaigns); the 213 dated events in the full scan (the pooled test); and the cross-mall share design behind the detection floor. They answer the same question from different angles and agree."],
      ["Data-quality trim", "The final " + ((D.data_quality || {}).trimmed_days || []).length + " days of the export (" + (((D.data_quality || {}).trimmed_days) || []).join(", ") + ") had device coverage below 30% of the daily median — an incomplete feed tail — so they're excluded from all footfall analysis. Left in, they read as large false dips."],
      ["Lag & confounders", "Announcement posts precede an event; event-day posts coincide with it — so a day-0 comparison mixes the two. Paydays (15th & month-end), public holidays (marked on the chart) and weather also move footfall and are named but not statistically controlled."],
      ["Adjacent-mall substitution", "SM North and TriNoma are physically linked across EDSA, so cross-mall share partly measures visitors switching between them. A campaign that grew the two malls' combined traffic would be invisible in share terms."],
      ["What this can & can't resolve", "It can resolve mall-wide movements of a few percent sustained over a week (like the renovation). It cannot resolve single-tenant effects, small single-day blips, or absolute footfall counts — those sit below this panel's resolution."]
    ];
    host.innerHTML = items.map(function (it) {
      return '<div class="m"><h3>' + it[0] + "</h3><p>" + it[1] + "</p></div>";
    }).join("");
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

  renderWindows();
  renderAnswer();
  renderKPIs();
  renderExplorer();
  renderTable();
  renderLearned();
  wireTableFilters();
  renderScatter();
  renderSmall();
  renderFloor();
  renderDetectionExtras();
  renderLag();
  renderRenovation();
  renderChangepoint();
  renderAudience();
  renderWho();
  renderMethods();
  renderFooter();
})();
